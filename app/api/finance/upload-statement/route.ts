import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { parseBankStatementPDF } from '@/lib/parseBankStatement'
import { batchMatchTransactions } from '@/lib/matchTransactionToMember'
import { autoDetectMembershipPayment } from '@/lib/autoDetectMembershipPayment'
import { uploadToR2, isR2Configured } from '@/lib/cloudflare-r2'

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

    // Check for duplicate statement upload
    // Get date range from parsed transactions
    const dates = parsed.transactions.map(t => t.date).filter(d => d)
    if (dates.length > 0) {
      const minDate = dates.reduce((a, b) => a < b ? a : b)
      const maxDate = dates.reduce((a, b) => a > b ? a : b)
      const firstTransactionName = parsed.transactions[0]?.name || ''
      const lastTransactionName = parsed.transactions[parsed.transactions.length - 1]?.name || ''
      
      // Check if we already have transactions from this exact date range with matching details
      const { rows: existingStatements } = await pool.query(`
        SELECT COUNT(*) as count
        FROM transactions
        WHERE account_id = $1
          AND transaction_date BETWEEN $2::date AND $3::date
          AND source = 'bank_statement'
        HAVING COUNT(*) >= $4
      `, [accountId || parsed.accountNumber, minDate, maxDate, Math.floor(parsed.transactions.length * 0.8)])
      
      if (existingStatements.length > 0 && existingStatements[0].count >= Math.floor(parsed.transactions.length * 0.8)) {
        return NextResponse.json({ 
          error: `This statement appears to have already been uploaded. Found ${existingStatements[0].count} existing transactions between ${minDate} and ${maxDate}. If you believe this is an error, please contact support.`,
          duplicate: true,
          dateRange: { min: minDate, max: maxDate },
          existingCount: existingStatements[0].count,
          newCount: parsed.transactions.length
        }, { status: 409 })
      }
    }

    // Determine which account to use
    let finalAccountId = accountId
    let isDonationAccount = false
    
    // If PDF has account number, try to match it to an existing account
    if (parsed.accountNumber) {
      console.log(`📋 PDF contains account number: ${parsed.accountNumber}`)
      const { rows: matchedAccounts } = await pool.query(
        'SELECT id, is_donation_account FROM financial_accounts WHERE account_number = $1',
        [parsed.accountNumber]
      )
      
      if (matchedAccounts.length > 0) {
        finalAccountId = matchedAccounts[0].id
        isDonationAccount = matchedAccounts[0].is_donation_account || false
        console.log(`✅ Matched to existing account: ${finalAccountId} (donation: ${isDonationAccount})`)
      } else {
        console.log(`⚠️ No account found with number ${parsed.accountNumber}, using provided account`)
      }
    } else {
      // Check if the provided account is a donation account
      const { rows: accountCheck } = await pool.query(
        'SELECT is_donation_account FROM financial_accounts WHERE id = $1',
        [finalAccountId]
      )
      if (accountCheck.length > 0) {
        isDonationAccount = accountCheck[0].is_donation_account || false
      }
    }

    // Get current account balance
    const { rows: accounts } = await pool.query(
      'SELECT current_balance FROM financial_accounts WHERE id = $1',
      [finalAccountId]
    )
    let runningBalance = accounts[0]?.current_balance || 0

    // Upload to R2 storage (if configured)
    let fileUrl: string | null = null
    if (isR2Configured()) {
      try {
        console.log('☁️ Uploading to Cloudflare R2...')
        fileUrl = await uploadToR2(buffer, file.name, file.type)
        console.log(`✅ Uploaded to R2: ${fileUrl}`)
      } catch (r2Error) {
        console.error('⚠️ R2 upload failed, continuing without file URL:', r2Error)
        // Don't fail the whole upload if R2 fails
      }
    } else {
      console.log('ℹ️ R2 not configured, skipping file upload')
    }

    // Create bank statement record
    const statementDates = parsed.transactions.map(t => t.date).filter(d => d)
    const minDate = statementDates.length > 0 ? statementDates.reduce((a, b) => a < b ? a : b) : null
    const maxDate = statementDates.length > 0 ? statementDates.reduce((a, b) => a > b ? a : b) : null
    
    const { rows: statementRows } = await pool.query(`
      INSERT INTO bank_statements 
        (account_id, file_name, file_size, file_type, statement_date_from, statement_date_to, transaction_count, uploaded_by, file_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      finalAccountId,
      file.name,
      file.size,
      file.type,
      minDate,
      maxDate,
      parsed.transactions.length,
      userId,
      fileUrl
    ])
    
    const statementId = statementRows[0]?.id
    console.log(`📄 Created bank statement record: ${statementId}${fileUrl ? ` with R2 URL` : ''}`)

    // Match transactions to members for categorization (CREDIT ONLY) - SKIP FOR DONATION ACCOUNTS
    let memberMatches: Array<{ memberId: string; memberName: string } | null> = []
    
    if (isDonationAccount) {
      console.log(`\n⚠️ Donation account detected - skipping member matching`)
      memberMatches = new Array(parsed.transactions.length).fill(null)
    } else {
    console.log(`\n=== Matching ${parsed.transactions.length} transactions to members ===`)
      memberMatches = await batchMatchTransactions(
      pool,
      parsed.transactions.map(txn => ({
        name: txn.name,
          description: txn.description,
          type: txn.type // Pass type to filter out debits
      }))
    )
    
    console.log(`✅ Matched ${memberMatches.filter(m => m !== null).length} transactions to members`)
    }
    
    // Insert transactions
    const insertedCount = []
    const failedTransactions: any[] = []
    const skippedTransactions: any[] = []
    
    console.log(`\n=== Inserting ${parsed.transactions.length} transactions ===`)
    
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
          name: txn.name?.substring(0, 50) || 'No name',
          description: txn.description?.substring(0, 50) || '',
          reason: 'No transaction amount found'
        })
        continue
      }

      try {
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(txn.date)) {
          const error = `Invalid date format: "${txn.date}"`
          console.error(`${error} for transaction: "${txn.name}"`)
          failedTransactions.push({ date: txn.date, name: txn.name, description: txn.description, error })
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
          console.error(`${error} for transaction: "${txn.name}"`)
          failedTransactions.push({ date: txn.date, name: txn.name, description: txn.description, error })
          continue
        }

        // Get monthly fee from system settings to determine category
        const { rows: feeRows } = await pool.query(
          "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
        )
        const monthlyFee = parseFloat(feeRows[0]?.value || '40.00')
        
        // Determine category based on amount - ONLY $40 is membership payment
        const category = Math.abs(amount) === monthlyFee ? 'Membership Payment' : 'Special Payment'
        
        const { rows: inserted } = await pool.query(
          `INSERT INTO transactions 
           (account_id, transaction_date, transaction_name, description, amount, transaction_type, balance_after, created_by, source, reference, category, statement_id, matched_member_id) 
           VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, 'bank_statement', $9, $10, $11, $12)
           ON CONFLICT DO NOTHING
           RETURNING id, transaction_date, transaction_name, description, category, matched_member_id`,
          [
            finalAccountId,
            txn.date,
            txn.name,
            txn.description,
            amount,
            txnType,
            txn.balance || runningBalance,
            userId,
            txn.reference,
            category,
            statementId,
            match ? match.memberId : null
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
        const error = err.message || 'Unknown error'
        console.error(`Failed to insert transaction (date: ${txn.date}, name: ${txn.name}):`, error)
        failedTransactions.push({ date: txn.date, name: txn.name, description: txn.description, error })
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
      skippedTransactions.forEach(s => console.log(`  - Date: ${s.date}, Name: ${s.name}, Reason: ${s.reason}`))
    }
    
    if (failedTransactions.length > 0) {
      console.log(`\nFailed transactions:`)
      failedTransactions.forEach(f => console.log(`  - Date: ${f.date}, Name: ${f.name}, Error: ${f.error}`))
    }

    // Update account balance to closing balance if available
    if (parsed.closingBalance !== undefined) {
      await pool.query(
        'UPDATE financial_accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2',
        [parsed.closingBalance, finalAccountId]
      )
      runningBalance = parsed.closingBalance
    } else {
      await pool.query(
        'UPDATE financial_accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2',
        [runningBalance, finalAccountId]
      )
    }

    // Audit log removed - logs system no longer in use

    // Auto-detect membership payments after upload
    try {
      // Get monthly fee from system settings
      const { rows: feeRows } = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
      )
      const monthlyFee = parseFloat(feeRows[0]?.value || '40.00')
      
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

      console.log(`Auto-detected ${paymentsDetected} membership payments`)
    } catch (err) {
      console.error('Failed to auto-detect payments:', err)
      // Don't fail the upload if payment detection fails
    }

    return NextResponse.json({ 
      success: true,
      transactionsImported: insertedCount.length,
      totalFound: parsed.transactions.length,
      skipped: skippedTransactions.length,
      skippedDetails: skippedTransactions,
      failed: failedTransactions.length,
      failedDetails: failedTransactions,
      newBalance: runningBalance,
      message: `Successfully imported ${insertedCount.length} of ${parsed.transactions.length} transactions.${skippedTransactions.length > 0 ? ` ${skippedTransactions.length} skipped (no amount).` : ''}${failedTransactions.length > 0 ? ` ${failedTransactions.length} failed.` : ''}`
    })
  } catch (err: any) {
    console.error('Upload statement error:', err)
    return NextResponse.json({ 
      error: err.message || 'Failed to parse bank statement. Please ensure it\'s a valid PDF format.' 
    }, { status: 500 })
  }
}

