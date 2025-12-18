import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { parseBankStatementPDF } from '@/lib/parseBankStatement'
import { batchMatchTransactions } from '@/lib/matchTransactionToMember'
import { autoDetectMembershipPayment } from '@/lib/autoDetectMembershipPayment'
import { uploadToR2, isR2Configured } from '@/lib/cloudflare-r2'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

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

        // Create bank statement record
        const statementDates = parsed.transactions.map(t => t.date).filter(d => d)
        const minDate = statementDates.length > 0 ? statementDates.reduce((a, b) => a < b ? a : b) : null
        const maxDate = statementDates.length > 0 ? statementDates.reduce((a, b) => a > b ? a : b) : null
        
        // Check for duplicate statement - same file name or overlapping date range
        const { rows: existingStatements } = await pool.query(`
          SELECT id, file_name, statement_date_from, statement_date_to 
          FROM bank_statements 
          WHERE account_id = $1 
            AND (
              file_name = $2 
              OR (
                statement_date_from IS NOT NULL 
                AND statement_date_to IS NOT NULL 
                AND $3::date IS NOT NULL 
                AND $4::date IS NOT NULL
                AND (statement_date_from <= $4::date AND statement_date_to >= $3::date)
              )
            )
        `, [accountId, document.file_name, minDate, maxDate])
        
        if (existingStatements.length > 0) {
          const existingFile = existingStatements[0]
          let errorMsg = ''
          if (existingFile.file_name === document.file_name) {
            errorMsg = `⚠️ Duplicate: A file named "${document.file_name}" has already been uploaded.`
          } else {
            errorMsg = `⚠️ Duplicate: A statement covering ${existingFile.statement_date_from} to ${existingFile.statement_date_to} already exists.`
          }
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
          minDate,
          maxDate,
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
                  match.memberName,
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

        // Update account balance
        if (parsed.closingBalance !== undefined) {
          await pool.query(
            'UPDATE financial_accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2',
            [parsed.closingBalance, accountId]
          )
          runningBalance = parsed.closingBalance
        } else {
          await pool.query(
            'UPDATE financial_accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2',
            [runningBalance, accountId]
          )
        }

        // Audit log removed - logs system no longer in use

        // Send completion message with summary
        let responseMessage = `✅ Bank statement processed successfully!\n\n`
        responseMessage += `📊 Summary:\n\n`
        responseMessage += `• Total transactions found: ${parsed.transactions.length}\n`
        responseMessage += `• Successfully imported: ${insertedCount.length}\n`
        responseMessage += `\n💰 New balance: $${runningBalance.toFixed(2)}`

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
      state.step = 'date'
      await sendTelegramMessage(chatId, '📆 Enter the event date (DD-MM-YYYY):\n\nExample: 25-12-2024')
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
      // Validate date format DD-MM-YYYY
      if (!/^\d{2}-\d{2}-\d{4}$/.test(text)) {
        await sendTelegramMessage(chatId, '❌ Invalid date format. Please use DD-MM-YYYY (e.g., 25-12-2024):')
        return
      }
      // Convert DD-MM-YYYY to YYYY-MM-DD for database
      const [day, month, year] = text.split('-')
      state.data.event_date = `${year}-${month}-${day}`
      state.step = 'start_time'
      await sendTelegramMessage(chatId, '🕐 Enter start time (HH:MM in 24-hour format):\n\nExample: 14:30')
      break

    case 'start_time':
      // Validate time format
      if (!/^\d{2}:\d{2}$/.test(text)) {
        await sendTelegramMessage(chatId, '❌ Invalid time format. Please use HH:MM (e.g., 14:30):')
        return
      }
      state.data.start_time = text
      state.step = 'end_time'
      await sendTelegramMessage(chatId, '🕐 Enter end time (HH:MM in 24-hour format):\n\nExample: 16:30')
      break

    case 'end_time':
      // Validate time format
      if (!/^\d{2}:\d{2}$/.test(text)) {
        await sendTelegramMessage(chatId, '❌ Invalid time format. Please use HH:MM (e.g., 16:30):')
        return
      }
      state.data.end_time = text
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
      state.step = 'confirm'
      await showEventConfirmation(chatId, state.data)
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
      state.step = 'address'
      await sendTelegramMessage(chatId, '🏠 Enter home address (or type "skip" to skip):')
      break

    case 'address':
      state.data.address = text.toLowerCase() === 'skip' ? null : text
      state.step = 'member_id'
      await sendTelegramMessage(chatId, '🆔 Enter member ID (or type "skip" to skip):')
      break

    case 'member_id':
      state.data.member_id = text.toLowerCase() === 'skip' ? null : text
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
      await createMember(chatId, state.data)
      userStates.delete(chatId)
      break
  }
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

// Show group selection
async function showGroupSelection(chatId: number): Promise<void> {
  try {
    // First try member_groups table
    const { rows: groups } = await pool.query(`
      SELECT id, name FROM member_groups ORDER BY name ASC
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
      // No groups found, try legacy group_name
      const { rows: legacyGroups } = await pool.query(`
        SELECT DISTINCT group_name as name 
        FROM users 
        WHERE group_name IS NOT NULL AND group_name != ''
        ORDER BY group_name ASC
      `)
      
      if (legacyGroups.length > 0) {
        const buttons = legacyGroups.map((g: any) => [{
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

// Show organizing group selection
async function showOrgGroupSelection(chatId: number): Promise<void> {
  try {
    // Try member_groups table first, fall back to users.group_name
    let groups: any[] = []
    try {
      const { rows } = await pool.query(`
        SELECT id, name FROM member_groups ORDER BY name ASC
      `)
      groups = rows
    } catch {
      // Fall back to unique group_name values from users
      const { rows } = await pool.query(`
        SELECT DISTINCT group_name as name FROM users 
        WHERE group_name IS NOT NULL AND group_name != ''
        ORDER BY group_name ASC
      `)
      groups = rows.map(r => ({ id: null, name: r.name }))
    }
    
    const buttons = groups.map((g: any) => [{
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
      await sendTelegramMessage(chatId, '📆 Enter the event date (DD-MM-YYYY):\n\nExample: 25-12-2024')
    }
  }
}

// Show event confirmation
async function showEventConfirmation(chatId: number, data: any): Promise<void> {
  // Convert date back to DD-MM-YYYY for display
  const [year, month, day] = data.event_date.split('-')
  const displayDate = `${day}-${month}-${year}`
  
  const summary = `
📅 <b>Event Summary</b>

<b>Title:</b> ${data.title}
<b>Date:</b> ${displayDate}
<b>Time:</b> ${data.start_time} - ${data.end_time}
${data.address ? `<b>Location:</b> ${data.address}` : ''}
${data.description ? `<b>Description:</b> ${data.description}` : ''}
${data.organizing_group ? `<b>Organizing Group:</b> ${data.organizing_group}` : ''}
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

    // Get all members as attendees
    const { rows: allMembers } = await pool.query(`
      SELECT id FROM users ORDER BY name ASC
    `)
    const attendees = allMembers.map((m: any) => m.id)

    const result = await pool.query(
      `INSERT INTO events (
        id, title, description, address, event_date, 
        start_time, end_time, estimated_cost, organizing_group, attendees
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9
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
        JSON.stringify(attendees),
      ]
    )

    const event = result.rows[0]
    await sendTelegramMessage(
      chatId,
      `✅ Event created successfully! 🎉`
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
    const result = await pool.query(
      `INSERT INTO users (
        id, name, email, phone, password_hash, address, role, 
        group_name, date_joined, household_members, member_id
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9
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

