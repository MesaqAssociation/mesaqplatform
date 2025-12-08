import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { parseBankStatementPDF } from '@/lib/parseBankStatement'
import { batchMatchTransactions } from '@/lib/matchTransactionToMember'
import { autoDetectMembershipPayment } from '@/lib/autoDetectMembershipPayment'
import { uploadToR2, isR2Configured } from '@/lib/cloudflare-r2'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()
    console.log('Telegram webhook received:', JSON.stringify(update, null, 2))

    // Only handle PDF documents
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

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
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

