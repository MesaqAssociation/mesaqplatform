import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { parseBankStatementPDF } from '@/lib/parseBankStatement'
import { batchMatchTransactions } from '@/lib/matchTransactionToMember'
import { autoDetectMembershipPayment } from '@/lib/autoDetectMembershipPayment'

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

    // Check if this is a document message
    if (update.message?.document) {
      const message = update.message
      const document = message.document
      const chatId = message.chat.id
      const userId = message.from.id
      const userName = message.from.first_name || 'User'

      console.log(`Document received from ${userName} (${userId}):`, document.file_name)

      // Check if it's a PDF
      if (document.mime_type !== 'application/pdf') {
        await sendTelegramMessage(
          chatId,
          '❌ Please send a PDF file. Only PDF bank statements are supported.'
        )
        return NextResponse.json({ ok: true })
      }

      // Send processing message
      await sendTelegramMessage(
        chatId,
        '📄 Bank statement received! Processing...'
      )

      try {
        // Download the PDF file
        const fileUrl = await getTelegramFileUrl(document.file_id)
        const pdfBuffer = await downloadFile(fileUrl)

        // Parse the PDF
        const parsed = await parseBankStatementPDF(pdfBuffer)

        if (parsed.transactions.length === 0) {
          await sendTelegramMessage(
            chatId,
            '❌ No transactions found in the PDF. Please ensure it\'s a valid bank statement.'
          )
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

            // Determine category based on member match
            const category = match ? match.memberName : 'Misc'
            
            const { rows: inserted } = await pool.query(
              `INSERT INTO transactions 
               (account_id, transaction_date, transaction_name, description, amount, transaction_type, balance_after, source, reference, category) 
               VALUES ($1, $2::date, $3, $4, $5, $6, $7, 'telegram_bot', $8, $9)
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
              ]
            )
            if (inserted.length > 0) {
              insertedCount.push(inserted[0])
              
              // Auto-detect membership payment if categorized to a member
              if (category !== 'Misc' && txnType === 'credit') {
                await autoDetectMembershipPayment(
                  pool,
                  inserted[0].id,
                  category,
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

        // Log the upload
        await pool.query(
          `INSERT INTO audit_logs (action, entity_type, details) 
           VALUES ('telegram_bank_statement_upload', 'bank_statement', $1)`,
          [JSON.stringify({
            telegramUserId: userId,
            telegramUserName: userName,
            fileName: document.file_name,
            transactionsFound: parsed.transactions.length,
            transactionsInserted: insertedCount.length,
            accountNumber: parsed.accountNumber,
          })]
        )

        // Send success message
        let responseMessage = `✅ Bank statement processed successfully!\n\n`
        responseMessage += `📊 Summary:\n\n`
        responseMessage += `• Total transactions found: ${parsed.transactions.length}\n`
        responseMessage += `• Successfully imported: ${insertedCount.length}\n`
        responseMessage += `\n💰 New balance: $${runningBalance.toFixed(2)}`

        if (parsed.accountNumber) {
          responseMessage += `\n🏦 Account: ${parsed.accountNumber}`
        }

        await sendTelegramMessage(chatId, responseMessage)

        // Auto-detect membership payments
        try {
          const monthlyFee = parseFloat(process.env.MONTHLY_FEE || '50.00')

          const { rows: members } = await pool.query(`
            SELECT id, banking_name, name, date_joined
            FROM users
            WHERE banking_name IS NOT NULL AND date_joined IS NOT NULL
          `)

          let paymentsDetected = 0

          for (const member of members) {
            const { rows: matchingTransactions } = await pool.query(`
              SELECT id, transaction_date
              FROM transactions
              WHERE 
                transaction_type = 'credit'
                AND ABS(amount) = $1
                AND (LOWER(description) LIKE LOWER($2) OR LOWER(description) LIKE LOWER($3))
                AND transaction_date >= $4
                AND id = ANY($5::uuid[])
            `, [
              monthlyFee,
              `%${member.banking_name}%`,
              `%${member.name}%`,
              member.date_joined,
              insertedCount.map(t => t.id)
            ])

            for (const txn of matchingTransactions) {
              const paymentMonth = new Date(txn.transaction_date)
              paymentMonth.setDate(1)
              const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

              await pool.query(`
                INSERT INTO membership_payments (user_id, payment_month, amount, transaction_id, payment_date, status)
                VALUES ($1, $2, $3, $4, $5, 'paid')
                ON CONFLICT (user_id, payment_month) DO NOTHING
              `, [member.id, paymentMonthStr, monthlyFee, txn.id, txn.transaction_date])

              paymentsDetected++
            }
          }

          // Silently detect payments without notification
        } catch (err) {
          console.error('Failed to auto-detect payments:', err)
        }

      } catch (err: any) {
        console.error('Error processing bank statement:', err)
        await sendTelegramMessage(
          chatId,
          `❌ Error processing bank statement: ${err.message || 'Unknown error'}`
        )
      }

      return NextResponse.json({ ok: true })
    }

    // Silently ignore all other messages (text, /start, etc.)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Telegram webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
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

