import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { parseBankStatementPDF } from '@/lib/parseBankStatement'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    userId = decoded.sub
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const accountId = formData.get('accountId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Only process PDF files
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ 
        error: 'Only PDF files are supported at this time' 
      }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse the PDF
    const parsed = await parseBankStatementPDF(buffer)

    if (parsed.transactions.length === 0) {
      return NextResponse.json({ 
        error: 'No transactions found in the statement. Please ensure the PDF is a valid bank statement.' 
      }, { status: 400 })
    }

    // Get current account balance
    const { rows: accounts } = await pool.query(
      'SELECT current_balance FROM financial_accounts WHERE id = $1',
      [accountId]
    )
    let runningBalance = accounts[0]?.current_balance || 0

    // Insert transactions
    const insertedCount = []
    const failedTransactions: any[] = []
    const skippedTransactions: any[] = []
    
    console.log(`\n=== Parsed ${parsed.transactions.length} transactions from PDF ===`)
    
    for (const txn of parsed.transactions) {
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
        // If no debit/credit specified but we have a balance, calculate from balance change
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
          description: txn.description?.substring(0, 50) || 'No description',
          reason: 'No transaction amount found'
        })
        continue
      }

      try {
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(txn.date)) {
          const error = `Invalid date format: "${txn.date}"`
          console.error(`${error} for transaction: "${txn.description}"`)
          failedTransactions.push({ date: txn.date, description: txn.description, error })
          continue
        }

        // Additional date validation - check if it's a valid date
        const dateParts = txn.date.split('-')
        const year = parseInt(dateParts[0])
        const month = parseInt(dateParts[1])
        const day = parseInt(dateParts[2])
        
        const testDate = new Date(year, month - 1, day)
        if (testDate.getFullYear() !== year || testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
          const error = `Invalid date values: ${txn.date}`
          console.error(`${error} for transaction: "${txn.description}"`)
          failedTransactions.push({ date: txn.date, description: txn.description, error })
          continue
        }

        await pool.query(
          `INSERT INTO transactions 
           (account_id, transaction_date, description, amount, transaction_type, balance_after, created_by, source, reference) 
           VALUES ($1, $2::date, $3, $4, $5, $6, $7, 'bank_statement', $8)
           ON CONFLICT DO NOTHING`,
          [
            accountId,
            txn.date,
            txn.description,
            amount,
            txnType,
            txn.balance || runningBalance,
            userId,
            txn.reference,
          ]
        )
        insertedCount.push(txn)
      } catch (err: any) {
        const error = err.message || 'Unknown error'
        console.error(`Failed to insert transaction (date: ${txn.date}, desc: ${txn.description}):`, error)
        failedTransactions.push({ date: txn.date, description: txn.description, error })
      }
    }
    
    // Log summary
    console.log(`\n=== Upload Summary ===`)
    console.log(`Total found: ${parsed.transactions.length}`)
    console.log(`Successfully inserted: ${insertedCount.length}`)
    console.log(`Skipped (no amount): ${skippedTransactions.length}`)
    console.log(`Failed: ${failedTransactions.length}`)
    
    if (skippedTransactions.length > 0) {
      console.log(`\nSkipped transactions:`)
      skippedTransactions.forEach(s => console.log(`  - Date: ${s.date}, Desc: ${s.description}, Reason: ${s.reason}`))
    }
    
    if (failedTransactions.length > 0) {
      console.log(`\nFailed transactions:`)
      failedTransactions.forEach(f => console.log(`  - Date: ${f.date}, Desc: ${f.description}, Error: ${f.error}`))
    }

    // Update account balance to closing balance if available
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
      `INSERT INTO audit_logs (user_id, action, entity_type, details) 
       VALUES ($1, 'bank_statement_upload', 'bank_statement', $2)`,
      [userId, JSON.stringify({ 
        fileName: file.name, 
        transactionsFound: parsed.transactions.length,
        transactionsInserted: insertedCount.length,
        accountNumber: parsed.accountNumber,
      })]
    )

    return NextResponse.json({ 
      success: true,
      transactionsImported: insertedCount.length,
      totalFound: parsed.transactions.length,
      failed: failedTransactions.length,
      failedDetails: failedTransactions.length > 0 ? failedTransactions : undefined,
      newBalance: runningBalance,
      message: `Successfully imported ${insertedCount.length} of ${parsed.transactions.length} transactions.${failedTransactions.length > 0 ? ` ${failedTransactions.length} failed.` : ''}`
    })
  } catch (err: any) {
    console.error('Upload statement error:', err)
    return NextResponse.json({ 
      error: err.message || 'Failed to parse bank statement. Please ensure it\'s a valid PDF format.' 
    }, { status: 500 })
  }
}

