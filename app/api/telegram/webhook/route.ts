import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { parseBankStatementPDF, validateTransactionDates } from '@/lib/parseBankStatement'
import { batchMatchTransactions } from '@/lib/matchTransactionToMember'
import { autoDetectMembershipPayment } from '@/lib/autoDetectMembershipPayment'
import { uploadToR2, isR2Configured } from '@/lib/cloudflare-r2'
import { sendBulkSMS, formatPhoneNumber, buildEventNotificationMessage, hasEnoughCreditsSimple, SMSMessage } from '@/lib/mobile-message'
import { storeSentMessagesBatch, generateBatchId, SentMessageData } from '@/lib/store-sent-message'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_ALLOWED_GROUP_ID = process.env.TELEGRAM_ALLOWED_GROUP_ID

// In-memory state management for multi-step creation flows
// In production, consider using Redis or database
type CreationState = {
  type: 'event' | 'member'
  step: string
  data: Record<string, any>
  timestamp: number
}

const userStates = new Map<number, CreationState>()

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()
    console.log('Telegram webhook received:', JSON.stringify(update, null, 2))

    // Get chat ID and type from message or callback query
    const chatInfo = update.message?.chat || update.callback_query?.message?.chat
    const incomingChatId = chatInfo?.id
    const chatType = chatInfo?.type

    // Check if TELEGRAM_ALLOWED_GROUP_ID is set and enforce group restriction
    if (TELEGRAM_ALLOWED_GROUP_ID) {
      const allowedGroupId = parseInt(TELEGRAM_ALLOWED_GROUP_ID, 10)
      
      // Only allow messages from supergroups with matching ID
      const isAllowedChat = chatType === 'supergroup' && incomingChatId === allowedGroupId
      
      if (!isAllowedChat) {
        console.log(`🚫 Blocked message from chat ${incomingChatId} (type: ${chatType}). Only allowed from supergroup ${allowedGroupId}`)
        
        // Send a message to inform the user (only for private chats, once)
        if (chatType === 'private' && incomingChatId) {
          await sendTelegramMessage(incomingChatId, '⚠️ This bot only works in the authorized group chat. Please use the bot there.')
        }
        
        return NextResponse.json({ ok: true })
      }
    }

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query)
      return NextResponse.json({ ok: true })
    }

    // Handle text commands
    if (update.message?.text) {
      const message = update.message
      const chatId = message.chat.id
      const text = message.text.trim()

      // Handle /start command
      if (text === '/start') {
        await sendTelegramMessage(chatId, '👋 Welcome! You can:\n\n📄 Send a PDF bank statement to upload it\n➕ Use /create to create events or members')
        return NextResponse.json({ ok: true })
      }

      // Handle /create command
      if (text === '/create') {
        await showCreateOptions(chatId)
        return NextResponse.json({ ok: true })
      }

      // Handle /cancel command
      if (text === '/cancel') {
        userStates.delete(chatId)
        await sendTelegramMessage(chatId, '❌ Operation cancelled.')
        return NextResponse.json({ ok: true })
      }

      // Check if user is in a creation flow
      const state = userStates.get(chatId)
      if (state) {
        await handleCreationInput(chatId, text, state)
        return NextResponse.json({ ok: true })
      }

      // Handle unrecognized commands or messages
      if (text.startsWith('/')) {
        // Unknown command
        await sendTelegramMessage(chatId, '❓ Unknown command. Available commands:\n\n/start - Show welcome message\n/create - Create event or member\n/cancel - Cancel current operation')
        return NextResponse.json({ ok: true })
      } else {
        // Regular message when not in a flow
        await sendTelegramMessage(chatId, '👋 Hi! Use /create to create events or members, or send a PDF bank statement to upload it.\n\nType /start for more info.')
        return NextResponse.json({ ok: true })
      }
    }

    // Handle PDF documents
    if (update.message?.document) {
      const message = update.message
      const document = message.document
      const chatId = message.chat.id
      const userName = message.from.first_name || 'User'

      console.log(`📎 Document received from ${userName}:`, document.file_name)

      // Check if it's a PDF
      if (document.mime_type !== 'application/pdf') {
        return NextResponse.json({ ok: true })
      }

      // Send processing message
      await sendTelegramMessage(chatId, '📄 Processing...')

      try {
        // Download the PDF file
        const telegramFileUrl = await getTelegramFileUrl(document.file_id)
        const pdfBuffer = await downloadFile(telegramFileUrl)

        // Parse the PDF
        const parsed = await parseBankStatementPDF(pdfBuffer)

        if (parsed.transactions.length === 0) {
          await sendTelegramMessage(chatId, '❌ No transactions found.')
          return NextResponse.json({ ok: true })
        }

        // Validate transaction dates are not too far in the future (max 30 days)
        const futureDates = validateTransactionDates(parsed.transactions)
        if (futureDates.length > 0) {
          await sendTelegramMessage(chatId, `❌ Statement contains transactions with dates too far in the future: ${futureDates.join(', ')}. Please check the statement year.`)
          return NextResponse.json({ ok: true })
        }

        // Get the default financial account (or create one)
        let accountId: string
        const { rows: accounts } = await pool.query(
          'SELECT id FROM financial_accounts ORDER BY created_at ASC LIMIT 1'
        )

        if (accounts.length === 0) {
          // Create default account
          const { rows: newAccount } = await pool.query(
            `INSERT INTO financial_accounts (name, account_type, current_balance) 
             VALUES ('Main Account', 'bank', 0) 
             RETURNING id`
          )
          accountId = newAccount[0].id
        } else {
          accountId = accounts[0].id
        }

        // Upload to R2 storage (if configured)
        let fileUrl: string | null = null
        if (isR2Configured()) {
          try {
            console.log('☁️ [Telegram] Uploading to Cloudflare R2...')
            fileUrl = await uploadToR2(pdfBuffer, document.file_name, 'application/pdf')
            console.log(`✅ [Telegram] Uploaded to R2: ${fileUrl}`)
          } catch (r2Error) {
            console.error('⚠️ [Telegram] R2 upload failed:', r2Error)
            // Continue without file URL
          }
        }

        // Use statement period from PDF if available, otherwise fall back to transaction dates
        let statementFromDate: string | null = null
        let statementToDate: string | null = null
        
        if (parsed.statementPeriod?.from && parsed.statementPeriod?.to) {
          statementFromDate = parsed.statementPeriod.from
          statementToDate = parsed.statementPeriod.to
          console.log(`📅 [Telegram] Using statement period from PDF: ${statementFromDate} to ${statementToDate}`)
        } else {
          const statementDates = parsed.transactions.map(t => t.date).filter(d => d)
          statementFromDate = statementDates.length > 0 ? statementDates.reduce((a, b) => a < b ? a : b) : null
          statementToDate = statementDates.length > 0 ? statementDates.reduce((a, b) => a > b ? a : b) : null
          console.log(`📅 [Telegram] Using transaction date range: ${statementFromDate} to ${statementToDate}`)
        }
        
        // Check for duplicate statement - overlapping date range only (not filename)
        const { rows: existingStatements } = await pool.query(`
          SELECT id, statement_date_from, statement_date_to 
          FROM bank_statements 
          WHERE account_id = $1 
            AND statement_date_from IS NOT NULL 
            AND statement_date_to IS NOT NULL 
            AND $2::date IS NOT NULL 
            AND $3::date IS NOT NULL
            AND (statement_date_from <= $3::date AND statement_date_to >= $2::date)
        `, [accountId, statementFromDate, statementToDate])
        
        if (existingStatements.length > 0) {
          const existingFile = existingStatements[0]
          // Format dates nicely - only check by date coverage, not filename
          const formatDate = (dateStr: string) => {
            try {
              const d = new Date(dateStr)
              return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })
            } catch { return dateStr }
          }
          const fromDate = formatDate(existingFile.statement_date_from)
          const toDate = formatDate(existingFile.statement_date_to)
          const errorMsg = `⚠️ A statement has already been uploaded for ${fromDate} - ${toDate}.`
          console.log(`[Telegram] ${errorMsg}`)
          
          // Send message back to user
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: errorMsg
            })
          })
          
          return NextResponse.json({ ok: true })
        }
        
        const { rows: statementRows } = await pool.query(`
          INSERT INTO bank_statements 
            (account_id, file_name, file_size, file_type, statement_date_from, statement_date_to, transaction_count, file_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          accountId,
          document.file_name,
          document.file_size || 0,
          'application/pdf',
          statementFromDate,
          statementToDate,
          parsed.transactions.length,
          fileUrl
        ])
        
        const statementId = statementRows[0]?.id
        console.log(`📄 [Telegram] Created bank statement record: ${statementId}${fileUrl ? ` with R2 URL` : ''}`)

        // Get current account balance
        const { rows: accountData } = await pool.query(
          'SELECT current_balance FROM financial_accounts WHERE id = $1',
          [accountId]
        )
        let runningBalance = accountData[0]?.current_balance || 0

        // Match transactions to members for categorization
        const memberMatches = await batchMatchTransactions(
          pool,
          parsed.transactions.map(txn => ({
            name: txn.name,
            description: txn.description
          }))
        )

        // Insert transactions
        const insertedCount = []
        const failedTransactions: any[] = []
        const skippedTransactions: any[] = []

        // Get monthly fee from settings for classification
        const { rows: feeRows } = await pool.query(
          "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
        )
        const monthlyFee = parseFloat(feeRows[0]?.value || '40.00')

        for (let idx = 0; idx < parsed.transactions.length; idx++) {
          const txn = parsed.transactions[idx]
          const match = memberMatches[idx]
          // Determine amount and type
          let amount = 0
          let txnType = 'debit'

          if (txn.credit && txn.credit > 0) {
            amount = txn.credit
            txnType = 'credit'
            runningBalance += amount
          } else if (txn.debit && txn.debit > 0) {
            amount = -txn.debit
            txnType = 'debit'
            runningBalance -= txn.debit
          } else {
            if (txn.balance !== undefined && txn.balance !== null) {
              const balanceChange = txn.balance - runningBalance
              if (balanceChange !== 0) {
                amount = balanceChange
                txnType = balanceChange > 0 ? 'credit' : 'debit'
                runningBalance = txn.balance
              }
            }
          }

          if (amount === 0) {
            skippedTransactions.push({
              date: txn.date,
              name: txn.name?.substring(0, 50) || 'No name',
              description: txn.description?.substring(0, 50) || '',
              reason: 'No transaction amount found'
            })
            continue
          }

          try {
            // Validate date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(txn.date)) {
              failedTransactions.push({
                date: txn.date,
                name: txn.name,
                description: txn.description,
                error: `Invalid date format: "${txn.date}"`
              })
              continue
            }

            // Auto-classify based on monthly fee
            const paymentAmount = Math.abs(amount)
            const isMultiple = paymentAmount % monthlyFee === 0 && paymentAmount > 0
            const category = isMultiple ? 'Membership Payment' : 'Special Payment'
            
            const { rows: inserted } = await pool.query(
              `INSERT INTO transactions 
               (account_id, transaction_date, transaction_name, description, amount, transaction_type, balance_after, source, reference, category, statement_id, matched_member_id) 
               VALUES ($1, $2::date, $3, $4, $5, $6, $7, 'telegram_bot', $8, $9, $10, $11)
               ON CONFLICT DO NOTHING
               RETURNING id, transaction_date, transaction_name, description, category`,
              [
                accountId,
                txn.date,
                txn.name,
                txn.description,
                amount,
                txnType,
                txn.balance || runningBalance,
                txn.reference,
                category,
                statementId,
                match ? match.memberId : null
              ]
            )
            if (inserted.length > 0) {
              insertedCount.push(inserted[0])
              
              // Auto-detect membership payment if it's a membership category
              if (category === 'Membership Payment' && txnType === 'credit' && match && match.memberId) {
                await autoDetectMembershipPayment(
                  pool,
                  inserted[0].id,
                  category,  // Pass 'Membership Payment' category, not member name
                  amount,
                  txn.date
                )
              }
            }
          } catch (err: any) {
            failedTransactions.push({
              date: txn.date,
              name: txn.name,
              description: txn.description,
              error: err.message || 'Unknown error'
            })
          }
        }

        // Update account balance ONLY if this is the most recent statement
        const { rows: latestStatements } = await pool.query(`
          SELECT statement_date_to FROM bank_statements 
          WHERE account_id = $1 AND statement_date_to IS NOT NULL
          ORDER BY statement_date_to DESC
          LIMIT 1
        `, [accountId])
        
        const latestStatementDate = latestStatements[0]?.statement_date_to
        const isNewestStatement = !latestStatementDate || 
          !statementToDate || 
          new Date(statementToDate) >= new Date(latestStatementDate)
        
        let balanceUpdated = false
        if (isNewestStatement) {
          if (parsed.closingBalance !== undefined) {
            await pool.query(
              'UPDATE financial_accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2',
              [parsed.closingBalance, accountId]
            )
            runningBalance = parsed.closingBalance
            balanceUpdated = true
          } else {
            await pool.query(
              'UPDATE financial_accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2',
              [runningBalance, accountId]
            )
            balanceUpdated = true
          }
        } else {
          console.log(`⚠️ Telegram: Skipping balance update - older statement`)
        }

        // Audit log removed - logs system no longer in use

        // Send completion message with summary
        let responseMessage = `✅ Bank statement processed successfully!\n\n`
        responseMessage += `📊 Summary:\n\n`
        responseMessage += `• Total transactions found: ${parsed.transactions.length}\n`
        responseMessage += `• Successfully imported: ${insertedCount.length}\n`
        
        if (balanceUpdated) {
          responseMessage += `\n💰 New balance: $${runningBalance.toFixed(2)}`
        }

        if (parsed.accountNumber) {
          responseMessage += `\n🏦 Account: ${parsed.accountNumber}`
        }

        await sendTelegramMessage(chatId, responseMessage)
      } catch (err: any) {
        console.error('Error processing bank statement:', err)
        await sendTelegramMessage(chatId, '❌ Error processing.')
      }

      return NextResponse.json({ ok: true })
    }

    // Silently ignore all other messages
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Telegram webhook error:', err)
    return NextResponse.json({ ok: true })
  }
}

async function getTelegramFileUrl(fileId: string): Promise<string> {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  )
  const data = await response.json()

  if (!data.ok) {
    throw new Error(`Failed to get file: ${data.description}`)
  }

  return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${data.result.file_path}`
}

async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function sendTelegramMessage(chatId: number, text: string, options?: any): Promise<void> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
          ...options,
        }),
      }
    )

    const data = await response.json()
    if (!data.ok) {
      console.error('Failed to send Telegram message:', data)
    }
  } catch (err) {
    console.error('Error sending Telegram message:', err)
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text,
        }),
      }
    )
  } catch (err) {
    console.error('Error answering callback query:', err)
  }
}

// Show initial create options
async function showCreateOptions(chatId: number): Promise<void> {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📅 Create Event', callback_data: 'create_event' },
        { text: '👤 Create Member', callback_data: 'create_member' },
      ],
    ],
  }

  await sendTelegramMessage(chatId, '➕ What would you like to create?', {
    reply_markup: keyboard,
  })
}

// Handle callback queries (button clicks)
async function handleCallbackQuery(callbackQuery: any): Promise<void> {
  const chatId = callbackQuery.message.chat.id
  const data = callbackQuery.data
  const callbackQueryId = callbackQuery.id

  await answerCallbackQuery(callbackQueryId)

  // Initial creation type selection
  if (data === 'create_event') {
    userStates.set(chatId, {
      type: 'event',
      step: 'title',
      data: {},
      timestamp: Date.now(),
    })
    await sendTelegramMessage(chatId, '📅 <b>Creating Event</b>\n\nPlease enter the event title:\n\n<i>Type /cancel to abort</i>')
  } else if (data === 'create_member') {
    userStates.set(chatId, {
      type: 'member',
      step: 'name',
      data: {},
      timestamp: Date.now(),
    })
    await sendTelegramMessage(chatId, '👤 <b>Creating Member</b>\n\nPlease enter the member\'s full name:\n\n<i>Type /cancel to abort</i>')
  }
  // Organizing group selection for event
  else if (data.startsWith('org_group_') && !data.includes('confirm')) {
    const state = userStates.get(chatId)
    if (state?.type === 'event' && state.step === 'organizing_group') {
      const group = data.replace('org_group_', '')
      state.data.organizing_group = group === 'none' ? null : group
      state.step = 'date_year'
      await showDateSelection(chatId)
    } else if (state?.type === 'event' && state.step === 'confirm') {
      // Final group selection after confirmation
      const group = data.replace('org_group_', '')
      state.data.organizing_group = group === 'none' ? null : group
      await createEvent(chatId, state.data)
      userStates.delete(chatId)
    }
  }
  // Member role selection
  else if (data.startsWith('role_')) {
    const state = userStates.get(chatId)
    if (state?.type === 'member') {
      const role = data.replace('role_', '').replace(/_/g, ' ')
      state.data.role = role
      state.step = 'group'
      await showGroupSelection(chatId)
    }
  }
  // Member group selection
  else if (data.startsWith('group_')) {
    const state = userStates.get(chatId)
    if (state?.type === 'member') {
      const group = data.replace('group_', '')
      state.data.group_name = group === 'none' ? null : group
      state.step = 'household'
      await sendTelegramMessage(chatId, '👥 How many household members? (Enter a number, e.g., 1, 2, 3)')
    }
  }
  // Handle notify option
  else if (data === 'notify_yes' || data === 'notify_no') {
    const state = userStates.get(chatId)
    if (state?.type === 'event') {
      state.data.notify_group = data === 'notify_yes'
      state.step = 'confirm'
      // Show loading indicator
      await sendTelegramMessage(chatId, '⏳ Loading summary...')
      await showEventConfirmation(chatId, state.data)
    }
  }
  // Handle year selection for date
  else if (data.startsWith('year_')) {
    const state = userStates.get(chatId)
    if (state?.type === 'event' && state.step === 'date_year') {
      state.data.selected_year = data.replace('year_', '')
      state.step = 'date_month'
      await showMonthSelection(chatId)
    }
  }
  // Handle month selection for date
  else if (data.startsWith('month_')) {
    const state = userStates.get(chatId)
    if (state?.type === 'event' && state.step === 'date_month') {
      state.data.selected_month = data.replace('month_', '')
      state.step = 'date_day'
      await showDaySelection(chatId, parseInt(state.data.selected_year), parseInt(state.data.selected_month))
    }
  }
  // Handle day selection for date
  else if (data.startsWith('day_')) {
    const state = userStates.get(chatId)
    if (state?.type === 'event' && state.step === 'date_day') {
      const day = data.replace('day_', '').padStart(2, '0')
      const month = state.data.selected_month.padStart(2, '0')
      const year = state.data.selected_year
      state.data.event_date = `${year}-${month}-${day}`
      state.step = 'start_time'
      await showTimeSelection(chatId, 'start')
    }
  }
  // Handle start time selection
  else if (data.startsWith('stime_')) {
    const state = userStates.get(chatId)
    if (state?.type === 'event' && state.step === 'start_time') {
      state.data.start_time = data.replace('stime_', '')
      state.step = 'end_time'
      await showTimeSelection(chatId, 'end', state.data.start_time)
    }
  }
  // Handle end time selection
  else if (data.startsWith('etime_')) {
    const state = userStates.get(chatId)
    if (state?.type === 'event' && state.step === 'end_time') {
      state.data.end_time = data.replace('etime_', '')
      state.step = 'cost'
      await sendTelegramMessage(chatId, '💰 What is the total cost for this event? (Enter amount in dollars, or type "0" for free):')
    }
  }
  // Handle back to year selection
  else if (data === 'back_to_year') {
    const state = userStates.get(chatId)
    if (state?.type === 'event') {
      state.step = 'date_year'
      await showDateSelection(chatId)
    }
  }
  // Handle back to month selection
  else if (data === 'back_to_month') {
    const state = userStates.get(chatId)
    if (state?.type === 'event') {
      state.step = 'date_month'
      await showMonthSelection(chatId)
    }
  }
  // Confirm creation
  else if (data === 'confirm_yes') {
    const state = userStates.get(chatId)
    if (state?.type === 'event') {
      // Event already has organizing group, just create it
      await createEvent(chatId, state.data)
      userStates.delete(chatId)
    }
  } else if (data === 'confirm_no') {
    userStates.delete(chatId)
    await sendTelegramMessage(chatId, '❌ Creation cancelled.')
  }
}

// Handle text input during creation flow
async function handleCreationInput(chatId: number, text: string, state: CreationState): Promise<void> {
  if (state.type === 'event') {
    await handleEventInput(chatId, text, state)
  } else if (state.type === 'member') {
    await handleMemberInput(chatId, text, state)
  }
}

// Handle event creation input
async function handleEventInput(chatId: number, text: string, state: CreationState): Promise<void> {
  switch (state.step) {
    case 'title':
      state.data.title = text
      state.step = 'description'
      await sendTelegramMessage(chatId, '📝 Enter event description (or type "skip" to skip):')
      break

    case 'description':
      state.data.description = text.toLowerCase() === 'skip' ? null : text
      state.step = 'address'
      await sendTelegramMessage(chatId, '📍 Enter event address (or type "skip" to skip):')
      break

    case 'address':
      state.data.address = text.toLowerCase() === 'skip' ? null : text
      state.step = 'organizing_group'
      await showOrgGroupSelection(chatId)
      break

    case 'date':
      // Validate date format D-M-YYYY or DD-MM-YYYY (allow single digits)
      if (!/^\d{1,2}-\d{1,2}-\d{4}$/.test(text)) {
        await sendTelegramMessage(chatId, '❌ Invalid date format. Please use D-M-YYYY or DD-MM-YYYY (e.g., 5-1-2025 or 25-12-2024):')
        return
      }
      // Convert D-M-YYYY to YYYY-MM-DD for database (pad with zeros)
      const [day, month, year] = text.split('-')
      const paddedDay = day.padStart(2, '0')
      const paddedMonth = month.padStart(2, '0')
      state.data.event_date = `${year}-${paddedMonth}-${paddedDay}`
      state.step = 'start_time'
      await sendTelegramMessage(chatId, '🕐 Enter start time (HH:MM in 24-hour format):\n\nExample: 14:30')
      break

    case 'start_time':
      // Validate time format (allow H:MM or HH:MM)
      if (!/^\d{1,2}:\d{2}$/.test(text)) {
        await sendTelegramMessage(chatId, '❌ Invalid time format. Please use HH:MM (e.g., 14:30 or 9:00):')
        return
      }
      // Pad hour with zero if needed
      const [startHour, startMin] = text.split(':')
      state.data.start_time = `${startHour.padStart(2, '0')}:${startMin}`
      state.step = 'end_time'
      await sendTelegramMessage(chatId, '🕐 Enter end time (HH:MM in 24-hour format):\n\nExample: 16:30')
      break

    case 'end_time':
      // Validate time format (allow H:MM or HH:MM)
      if (!/^\d{1,2}:\d{2}$/.test(text)) {
        await sendTelegramMessage(chatId, '❌ Invalid time format. Please use HH:MM (e.g., 16:30 or 9:00):')
        return
      }
      // Pad hour with zero if needed
      const [endHour, endMin] = text.split(':')
      state.data.end_time = `${endHour.padStart(2, '0')}:${endMin}`
      state.step = 'cost'
      await sendTelegramMessage(chatId, '💰 What is the total cost for this event? (Enter amount in dollars, or type "0" for free):')
      break

    case 'cost':
      const cost = parseFloat(text)
      if (isNaN(cost) || cost < 0) {
        await sendTelegramMessage(chatId, '❌ Invalid amount. Please enter a number (e.g., 100 or 0):')
        return
      }
      state.data.estimated_cost = cost
      // Only ask about notifications if an organizing group was selected
      if (state.data.organizing_group) {
        state.step = 'notify'
        await showNotifyOption(chatId)
      } else {
        state.step = 'confirm'
        await showEventConfirmation(chatId, state.data)
      }
      break
  }
}

// Handle member creation input
async function handleMemberInput(chatId: number, text: string, state: CreationState): Promise<void> {
  switch (state.step) {
    case 'name':
      state.data.name = text
      state.step = 'phone'
      await sendTelegramMessage(chatId, '📱 Enter phone number (e.g., 0412345678):')
      break

    case 'phone':
      // Basic phone validation
      const cleanPhone = text.replace(/\s+/g, '')
      if (!/^\d{10}$/.test(cleanPhone) && !/^04\d{8}$/.test(cleanPhone)) {
        await sendTelegramMessage(chatId, '❌ Invalid phone number. Please enter a 10-digit Australian mobile (e.g., 0412345678):')
        return
      }
      state.data.phone = cleanPhone
      state.step = 'email'
      await sendTelegramMessage(chatId, '📧 Enter email address (or type "skip" to skip):')
      break

    case 'email':
      if (text.toLowerCase() !== 'skip') {
        // Basic email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
          await sendTelegramMessage(chatId, '❌ Invalid email format. Please enter a valid email or type "skip":')
          return
        }
        state.data.email = text
      }
      state.step = 'password'
      await sendTelegramMessage(chatId, '🔒 Enter a password (minimum 8 characters):')
      break

    case 'password':
      if (text.length < 8) {
        await sendTelegramMessage(chatId, '❌ Password must be at least 8 characters. Please try again:')
        return
      }
      state.data.password = text
      state.step = 'role'
      await showRoleSelection(chatId)
      break

    case 'household':
      const household = parseInt(text)
      if (isNaN(household) || household < 1) {
        await sendTelegramMessage(chatId, '❌ Please enter a valid number (1 or more):')
        return
      }
      state.data.household_members = household
      
      // Create member directly (no advanced fields in telegram flow for simplicity)
      await createMember(chatId, state.data)
      userStates.delete(chatId)
      break
  }
}

// Fetch custom member fields from system_settings
async function getCustomFields(): Promise<Array<{key: string, name: string}>> {
  try {
    const { rows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'custom_member_fields'"
    )
    if (rows[0]?.value) {
      return JSON.parse(rows[0].value)
    }
  } catch (err) {
    console.error('Error fetching custom fields:', err)
  }
  return []
}

// Show notify option for event
async function showNotifyOption(chatId: number): Promise<void> {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Yes, notify members', callback_data: 'notify_yes' },
        { text: '❌ No notifications', callback_data: 'notify_no' },
      ],
    ],
  }
  await sendTelegramMessage(chatId, '📱 Send WhatsApp notifications to organizing group members?', { reply_markup: keyboard })
}

// Show date selection - year first (dynamic, always shows current and next 2 years)
async function showDateSelection(chatId: number): Promise<void> {
  const currentYear = new Date().getFullYear()
  const keyboard = {
    inline_keyboard: [
      [
        { text: `${currentYear}`, callback_data: `year_${currentYear}` },
        { text: `${currentYear + 1}`, callback_data: `year_${currentYear + 1}` },
        { text: `${currentYear + 2}`, callback_data: `year_${currentYear + 2}` },
      ],
    ],
  }
  await sendTelegramMessage(chatId, '📆 Select year:', { reply_markup: keyboard })
}

// Show month selection with back button
async function showMonthSelection(chatId: number): Promise<void> {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  const buttons = []
  for (let i = 0; i < 12; i += 4) {
    const row = []
    for (let j = i; j < i + 4 && j < 12; j++) {
      row.push({ text: months[j], callback_data: `month_${j + 1}` })
    }
    buttons.push(row)
  }
  // Add back button
  buttons.push([{ text: '⬅️ Back to Year', callback_data: 'back_to_year' }])
  const keyboard = { inline_keyboard: buttons }
  await sendTelegramMessage(chatId, '📆 Select month:', { reply_markup: keyboard })
}

// Show day selection with back button
async function showDaySelection(chatId: number, year: number, month: number): Promise<void> {
  const daysInMonth = new Date(year, month, 0).getDate()
  const buttons = []
  for (let i = 1; i <= daysInMonth; i += 7) {
    const row = []
    for (let j = i; j < i + 7 && j <= daysInMonth; j++) {
      row.push({ text: `${j}`, callback_data: `day_${j}` })
    }
    buttons.push(row)
  }
  // Add back button
  buttons.push([{ text: '⬅️ Back to Month', callback_data: 'back_to_month' }])
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']
  const keyboard = { inline_keyboard: buttons }
  await sendTelegramMessage(chatId, `📆 Select day (${monthNames[month]} ${year}):`, { reply_markup: keyboard })
}

// Show time selection
async function showTimeSelection(chatId: number, type: 'start' | 'end', startTime?: string): Promise<void> {
  // Start times: 8:00 AM to 11:00 PM (no midnight)
  const startTimes = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00'
  ]
  
  // End times: Include midnight (00:00) which represents end of day
  const endTimes = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', 
    '23:00', '23:30', '00:00'  // Midnight at the end
  ]
  
  let availableTimes: string[]
  if (type === 'start') {
    availableTimes = startTimes
  } else {
    // For end time, filter to show times after start time
    // Treat 00:00 (midnight) as 24:00 for comparison purposes
    availableTimes = endTimes.filter(t => {
      if (!startTime) return true
      const tValue = t === '00:00' ? '24:00' : t
      return tValue > startTime
    })
  }
  
  // Convert to 12-hour format for display
  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    if (t === '00:00') return '12:00AM (Midnight)'
    const period = h >= 12 ? 'PM' : 'AM'
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hour12}:${m.toString().padStart(2, '0')}${period}`
  }
  
  const prefix = type === 'start' ? 'stime' : 'etime'
  const buttons = []
  for (let i = 0; i < availableTimes.length; i += 4) {
    const row = []
    for (let j = i; j < i + 4 && j < availableTimes.length; j++) {
      row.push({ text: formatTime(availableTimes[j]), callback_data: `${prefix}_${availableTimes[j]}` })
    }
    buttons.push(row)
  }
  
  const keyboard = { inline_keyboard: buttons }
  const label = type === 'start' ? '🕐 Select start time:' : '🕐 Select end time:'
  await sendTelegramMessage(chatId, label, { reply_markup: keyboard })
}

// Show event type selection
async function showEventTypeSelection(chatId: number): Promise<void> {
  const keyboard = {
    inline_keyboard: [
      [{ text: '🎉 Event', callback_data: 'event_type_Event' }],
      [{ text: '📚 Meeting', callback_data: 'event_type_Meeting' }],
      [{ text: '🎊 Celebration', callback_data: 'event_type_Celebration' }],
      [{ text: '📖 Educational', callback_data: 'event_type_Educational' }],
      [{ text: '🙏 Religious', callback_data: 'event_type_Religious' }],
    ],
  }
  await sendTelegramMessage(chatId, '🎯 Select event type:', { reply_markup: keyboard })
}

// Show role selection
async function showRoleSelection(chatId: number): Promise<void> {
  const keyboard = {
    inline_keyboard: [
      [{ text: '👤 Community Member', callback_data: 'role_Community_Member' }],
      [{ text: '👔 Manager', callback_data: 'role_Manager' }],
      [{ text: '📋 Public Officer', callback_data: 'role_Public_Officer' }],
      [{ text: '💰 Finance Officer', callback_data: 'role_Finance_Officer' }],
      [{ text: '📦 Logistics Officer', callback_data: 'role_Logistics_Officer' }],
    ],
  }
  await sendTelegramMessage(chatId, '👔 Select member role:', { reply_markup: keyboard })
}

// Show group selection - uses unique group_name from users table as source of truth
async function showGroupSelection(chatId: number): Promise<void> {
  try {
    // Get unique group names from users table
    const { rows: groups } = await pool.query(`
      SELECT DISTINCT group_name as name 
      FROM users 
      WHERE group_name IS NOT NULL AND group_name != ''
      ORDER BY group_name ASC
    `)
    
    if (groups.length > 0) {
      const buttons = groups.map((g: any) => [{
        text: g.name,
        callback_data: `group_${g.name}`,
      }])
      buttons.push([{ text: '❌ No Group', callback_data: 'group_none' }])

      const keyboard = { inline_keyboard: buttons }
      await sendTelegramMessage(chatId, '👥 Select member group:', { reply_markup: keyboard })
    } else {
      // No groups at all, skip to household
      const state = userStates.get(chatId)
      if (state) {
        state.data.group_name = null
        state.step = 'household'
        await sendTelegramMessage(chatId, '👥 How many household members? (Enter a number)')
      }
    }
  } catch (err) {
    console.error('Error loading groups:', err)
    const state = userStates.get(chatId)
    if (state) {
      state.data.group_name = null
      state.step = 'household'
      await sendTelegramMessage(chatId, '👥 How many household members? (Enter a number)')
    }
  }
}

// Show organizing group selection - uses unique group_name from users table as source of truth
async function showOrgGroupSelection(chatId: number): Promise<void> {
  try {
    // Get unique group_name values from users table
    const { rows } = await pool.query(`
      SELECT DISTINCT group_name as name FROM users 
      WHERE group_name IS NOT NULL AND group_name != ''
      ORDER BY group_name ASC
    `)
    
    if (rows.length === 0) {
      // No groups found, skip to date
      const state = userStates.get(chatId)
      if (state?.type === 'event') {
        state.data.organizing_group = null
        state.step = 'date'
        await showDateSelection(chatId)
      }
      return
    }
    
    const buttons = rows.map((g: any) => [{
      text: g.name,
      callback_data: `org_group_${g.name}`,
    }])
    buttons.push([{ text: '❌ No Group', callback_data: 'org_group_none' }])

    const keyboard = { inline_keyboard: buttons }
    await sendTelegramMessage(chatId, '👥 Select organizing group (optional):', { reply_markup: keyboard })
  } catch (err) {
    console.error('Error loading groups:', err)
    // On error, skip group selection and continue to date
    const state = userStates.get(chatId)
    if (state?.type === 'event') {
      state.data.organizing_group = null
      state.step = 'date'
      await showDateSelection(chatId)
    }
  }
}

// Show event confirmation
async function showEventConfirmation(chatId: number, data: any): Promise<void> {
  // Convert date back to DD-MM-YYYY for display
  const [year, month, day] = data.event_date.split('-')
  const displayDate = `${day}-${month}-${year}`
  
  const notifyStatus = data.organizing_group 
    ? (data.notify_group ? '✅ Yes' : '❌ No')
    : 'N/A'
  
  const summary = `
📅 <b>Event Summary</b>

<b>Title:</b> ${data.title}
<b>Date:</b> ${displayDate}
<b>Time:</b> ${data.start_time} - ${data.end_time}
${data.address ? `<b>Location:</b> ${data.address}` : ''}
${data.description ? `<b>Description:</b> ${data.description}` : ''}
${data.organizing_group ? `<b>Organizing Group:</b> ${data.organizing_group}` : ''}
${data.organizing_group ? `<b>Notify Members:</b> ${notifyStatus}` : ''}
<b>Total Cost:</b> $${data.estimated_cost || 0}

Ready to create this event?
  `.trim()

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Create Event', callback_data: 'confirm_yes' },
        { text: '❌ Cancel', callback_data: 'confirm_no' },
      ],
    ],
  }

  await sendTelegramMessage(chatId, summary, { reply_markup: keyboard })
}

// Create event in database
async function createEvent(chatId: number, data: any): Promise<void> {
  try {
    await sendTelegramMessage(chatId, '⏳ Creating event...')

    const result = await pool.query(
      `INSERT INTO events (
        id, title, description, address, event_date, 
        start_time, end_time, estimated_cost, organizing_group
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING id, title, event_date`,
      [
        data.title,
        data.description || null,
        data.address || null,
        data.event_date,
        data.start_time,
        data.end_time,
        data.estimated_cost || 0,
        data.organizing_group || null,
      ]
    )

    const event = result.rows[0]
    
    // Update last organizing group and send notifications if requested
    if (data.organizing_group) {
      await pool.query(`
        INSERT INTO system_settings (key, value)
        VALUES ('last_organizing_group', $1)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value
      `, [data.organizing_group])

      // Send SMS notifications if requested
      if (data.notify_group) {
        try {
          const { rows: groupMembers } = await pool.query(`
            SELECT id, name, phone 
            FROM users 
            WHERE group_name = $1 AND phone IS NOT NULL
          `, [data.organizing_group])

          const membersWithPhone = groupMembers.filter((m: any) => m.phone)
          
          if (membersWithPhone.length > 0) {
            // Check credit balance before sending (estimate 2 credits per event notification)
            if (process.env.MOBILE_MESSAGE_USERNAME) {
              const creditCheck = await hasEnoughCreditsSimple(membersWithPhone.length * 2)
              
              if (!creditCheck.hasEnough) {
                await sendTelegramMessage(chatId, `⚠️ Event created but notifications NOT sent - insufficient credits. Need ${creditCheck.requiredCredits} credits, have ${creditCheck.currentCredits}. Please top up.`)
                return
              }
            }

            // Format the event date for display with time
            const eventDate = new Date(data.event_date)
            const formattedDateOnly = eventDate.toLocaleDateString('en-AU', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })
            
            // Format times to 12-hour format
            const formatTo12Hour = (time24: string) => {
              const [h, m] = time24.split(':').map(Number)
              const period = h >= 12 ? 'PM' : 'AM'
              const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
              return `${hour12}:${m.toString().padStart(2, '0')}${period}`
            }
            
            const startTime12 = formatTo12Hour(data.start_time)
            const endTime12 = formatTo12Hour(data.end_time)
            const formattedDate = `${formattedDateOnly} ${startTime12} - ${endTime12}`

            const allMemberNames = membersWithPhone.map((m: any) => m.name)
            
            // Prepare SMS messages for each member
            const smsMessages: SMSMessage[] = membersWithPhone.map((member: any) => {
              const otherMembers = allMemberNames
                .filter((name: string) => name !== member.name)
                .join(', ') || 'None'
              return {
                to: member.phone,
                message: buildEventNotificationMessage(
                  member.name,
                  data.title,
                  formattedDate,
                  data.organizing_group,
                  otherMembers
                )
              }
            })

            const notifyResult = await sendBulkSMS(smsMessages)
            console.log(`✅ Event SMS notifications from Telegram bot: ${notifyResult.sent} sent, ${notifyResult.failed} failed`)

            // Store sent messages with external message IDs
            const batchId = generateBatchId()
            const sentMessageData: SentMessageData[] = membersWithPhone.map((m: any) => {
              const phone = formatPhoneNumber(m.phone)
              const otherMembers = allMemberNames.filter((name: string) => name !== m.name).join(', ') || 'None'
              // Find the matching result by phone number
              const apiResult = notifyResult.results.find(r => r.to === phone)
              
              return {
                messageType: 'event_notification' as const,
                templateId: undefined,
                messageContent: buildEventNotificationMessage(
                  m.name,
                  data.title,
                  formattedDate,
                  data.organizing_group,
                  otherMembers
                ),
                recipientPhone: phone,
                recipientName: m.name,
                recipientMemberId: m.id,
                status: apiResult?.status === 'sent' ? 'sent' : apiResult?.status === 'failed' ? 'failed' : 'sent',
                externalMessageId: apiResult?.messageId || undefined,
                errorMessage: apiResult?.error || undefined,
                batchId
              }
            })
            await storeSentMessagesBatch(pool, sentMessageData, batchId)
          }
        } catch (notifyErr) {
          console.error('Failed to send SMS notifications:', notifyErr)
        }
      }
    }
    
    const notificationStatus = data.notify_group && data.organizing_group 
      ? '\n📱 SMS notifications sent to group members!'
      : ''
    
    await sendTelegramMessage(
      chatId,
      `✅ Event created successfully! 🎉${notificationStatus}`
    )
  } catch (err: any) {
    console.error('Error creating event:', err)
    await sendTelegramMessage(chatId, `❌ Failed to create event: ${err.message}`)
  }
}

// Create member in database
async function createMember(chatId: number, data: any): Promise<void> {
  try {
    await sendTelegramMessage(chatId, '⏳ Creating member...')

    const hashed = await bcrypt.hash(data.password, 10)
    const customData = data.custom_data && Object.keys(data.custom_data).length > 0 
      ? JSON.stringify(data.custom_data) 
      : '{}'
    
    const result = await pool.query(
      `INSERT INTO users (
        id, name, email, phone, password_hash, address, role, 
        group_name, date_joined, household_members, member_id, custom_data
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10::jsonb
      ) RETURNING id, name, phone, role`,
      [
        data.name,
        data.email || null,
        data.phone,
        hashed,
        data.address || null,
        data.role || 'Community Member',
        data.group_name || null,
        data.household_members || 1,
        data.member_id || null,
        customData,
      ]
    )

    const member = result.rows[0]
    await sendTelegramMessage(
      chatId,
      `✅ Member created successfully! 🎉`
    )
  } catch (err: any) {
    console.error('Error creating member:', err)
    let errorMsg = 'Failed to create member'
    
    if (err.code === '23505') {
      if (err.constraint?.includes('phone')) {
        errorMsg = 'This phone number is already registered'
      } else if (err.constraint?.includes('email')) {
        errorMsg = 'This email is already registered'
      }
    }
    
    await sendTelegramMessage(chatId, `❌ ${errorMsg}`)
  }
}

