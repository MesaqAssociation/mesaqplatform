import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Helper function to verify auth
async function verifyAuth(): Promise<{ userId: string } | null> {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return null
  }
  
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    return { userId: decoded.sub }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const auth = await verifyAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!accountId || !year || !month) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // Get transactions for specific month
    const { rows: transactions } = await pool.query(`
      SELECT 
        t.id,
        t.account_id,
        to_char(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
        t.transaction_name,
        t.description,
        t.category,
        t.amount,
        t.transaction_type,
        t.reference,
        t.balance_after,
        t.created_by,
        t.source,
        t.matched_member_id,
        t.statement_id,
        t.created_at,
        u.name as creator_name,
        m.name as matched_member_name,
        bs.file_name as statement_file_name,
        to_char(bs.statement_date_from, 'YYYY-MM-DD') as statement_date_from,
        to_char(bs.statement_date_to, 'YYYY-MM-DD') as statement_date_to
      FROM transactions t 
      LEFT JOIN users u ON t.created_by = u.id 
      LEFT JOIN users m ON t.matched_member_id = m.id
      LEFT JOIN bank_statements bs ON t.statement_id = bs.id
      WHERE t.account_id = $1 
        AND EXTRACT(YEAR FROM t.transaction_date) = $2
        AND EXTRACT(MONTH FROM t.transaction_date) = $3
      ORDER BY t.transaction_date DESC, t.created_at DESC
    `, [accountId, year, month])

    // Get current balance for account
    const { rows: accountRows } = await pool.query(
      'SELECT current_balance FROM financial_accounts WHERE id = $1',
      [accountId]
    )

    return NextResponse.json({ 
      transactions,
      balance: accountRows[0]?.current_balance || 0
    })
  } catch (err: any) {
    console.error('Get transactions error:', err)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

// Create a manual transaction
export async function POST(req: NextRequest) {
  const auth = await verifyAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { 
      accountId, 
      transactionDate, 
      transactionName, 
      description, 
      amount, 
      transactionType,
      matchedMemberId 
    } = body

    // Validation
    if (!accountId || !transactionDate || !transactionName || !amount || !transactionType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['credit', 'debit'].includes(transactionType)) {
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 })
    }

    // Get current balance
    const { rows: accountRows } = await pool.query(
      'SELECT current_balance FROM financial_accounts WHERE id = $1',
      [accountId]
    )

    if (accountRows.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const currentBalance = parseFloat(accountRows[0].current_balance)
    const transactionAmount = parseFloat(amount)
    
    // Calculate new balance
    const balanceAfter = transactionType === 'credit' 
      ? currentBalance + transactionAmount 
      : currentBalance - transactionAmount

    // Get monthly fee to determine category
    const { rows: feeRows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
    )
    const monthlyFee = parseFloat(feeRows[0]?.value || '40.00')
    
    // Determine category based on amount
    const category = Math.abs(transactionAmount) === monthlyFee ? 'Membership Payment' : 'Special Payment'

    // Insert transaction
    const { rows: newTransaction } = await pool.query(`
      INSERT INTO transactions (
        account_id, 
        transaction_date, 
        transaction_name, 
        description, 
        amount, 
        transaction_type,
        category,
        balance_after,
        created_by,
        source,
        matched_member_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        id,
        account_id,
        to_char(transaction_date, 'YYYY-MM-DD') as transaction_date,
        transaction_name,
        description,
        category,
        amount,
        transaction_type,
        reference,
        balance_after,
        created_by,
        source,
        matched_member_id,
        created_at
    `, [
      accountId,
      transactionDate,
      transactionName,
      description || '',
      transactionAmount,
      transactionType,
      category,
      balanceAfter,
      auth.userId,
      'manual',
      matchedMemberId || null
    ])

    // Update account balance
    await pool.query(
      'UPDATE financial_accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2',
      [balanceAfter, accountId]
    )

    // Create membership payment record if matched to member
    if (matchedMemberId) {
      const txnDate = new Date(transactionDate + 'T00:00:00')
      const paymentMonth = new Date(txnDate.getFullYear(), txnDate.getMonth(), 1)
      const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

      try {
        await pool.query(`
          INSERT INTO membership_payments (user_id, payment_month, amount, transaction_id, payment_date, status)
          VALUES ($1, $2, $3, $4, $5, 'paid')
        `, [matchedMemberId, paymentMonthStr, Math.abs(transactionAmount), newTransaction[0].id, transactionDate])
        
        console.log(`✅ Created membership payment for new transaction: ${matchedMemberId} - $${Math.abs(transactionAmount)} for ${paymentMonthStr}`)
      } catch (paymentErr: any) {
        console.error('Failed to create membership payment for new transaction:', paymentErr.message)
        // Don't fail the transaction creation if payment record fails
      }
    }

    // Get member name if matched
    let matchedMemberName = null
    if (matchedMemberId) {
      const { rows: memberRows } = await pool.query(
        'SELECT name FROM users WHERE id = $1',
        [matchedMemberId]
      )
      matchedMemberName = memberRows[0]?.name || null
    }

    // Get creator name
    const { rows: userRows } = await pool.query(
      'SELECT name FROM users WHERE id = $1',
      [auth.userId]
    )

    return NextResponse.json({ 
      transaction: {
        ...newTransaction[0],
        creator_name: userRows[0]?.name || null,
        matched_member_name: matchedMemberName
      }
    })
  } catch (err: any) {
    console.error('Create transaction error:', err)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}

// Match a transaction to a member
export async function PATCH(req: NextRequest) {
  const auth = await verifyAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { transactionId, memberId } = body

    console.log('PATCH request - transactionId:', transactionId, 'memberId:', memberId)

    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 })
    }

    // First check if the column exists
    try {
      await pool.query('SELECT matched_member_id FROM transactions LIMIT 1')
    } catch (colErr: any) {
      console.error('Column check error:', colErr.message)
      return NextResponse.json({ 
        error: 'Database schema not updated. Please run the migration: supabase-add-matched-member.sql',
        details: colErr.message 
      }, { status: 500 })
    }

    // Update transaction with member match
    const { rows: updatedTransaction } = await pool.query(`
      UPDATE transactions 
      SET 
        matched_member_id = $1::text,
        category = CASE 
          WHEN $1::text IS NOT NULL THEN 'Member Payment'
          ELSE 'Misc'
        END
      WHERE id = $2
      RETURNING 
        id,
        account_id,
        to_char(transaction_date, 'YYYY-MM-DD') as transaction_date,
        transaction_name,
        description,
        category,
        amount,
        transaction_type,
        reference,
        balance_after,
        created_by,
        source,
        matched_member_id,
        created_at
    `, [memberId || null, transactionId])

    if (updatedTransaction.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const transaction = updatedTransaction[0]

    // Handle membership payment record
    if (memberId) {
      // Member matched - create/update membership payment
      const txnDate = new Date(transaction.transaction_date + 'T00:00:00')
      const paymentMonth = new Date(txnDate.getFullYear(), txnDate.getMonth(), 1)
      const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

      // Delete existing payment record for this transaction (in case of re-matching)
      await pool.query(
        'DELETE FROM membership_payments WHERE transaction_id = $1',
        [transactionId]
      )

      // Create new payment record
      try {
        await pool.query(`
          INSERT INTO membership_payments (user_id, payment_month, amount, transaction_id, payment_date, status)
          VALUES ($1, $2, $3, $4, $5, 'paid')
        `, [memberId, paymentMonthStr, Math.abs(transaction.amount), transactionId, transaction.transaction_date])
        
        console.log(`✅ Created membership payment: ${memberId} - $${Math.abs(transaction.amount)} for ${paymentMonthStr}`)
      } catch (paymentErr: any) {
        console.error('Failed to create membership payment:', paymentErr.message)
        // Don't fail the transaction match if payment record fails
      }
    } else {
      // Member unmatched - delete membership payment record
      await pool.query(
        'DELETE FROM membership_payments WHERE transaction_id = $1',
        [transactionId]
      )
      console.log(`🗑️ Deleted membership payment for transaction: ${transactionId}`)
    }

    // Get member name if matched
    let matchedMemberName = null
    if (memberId) {
      const { rows: memberRows } = await pool.query(
        'SELECT name FROM users WHERE id = $1',
        [memberId]
      )
      matchedMemberName = memberRows[0]?.name || null
    }

    // Get creator name
    const { rows: userRows } = await pool.query(
      'SELECT name FROM users WHERE id = $1',
      [transaction.created_by]
    )

    console.log('Successfully matched transaction:', transactionId, 'to member:', matchedMemberName)

    return NextResponse.json({ 
      transaction: {
        ...updatedTransaction[0],
        creator_name: userRows[0]?.name || null,
        matched_member_name: matchedMemberName
      }
    })
  } catch (err: any) {
    console.error('Match transaction error:', err)
    console.error('Error details:', err.message, err.code)
    return NextResponse.json({ 
      error: 'Failed to match transaction',
      details: err.message 
    }, { status: 500 })
  }
}

// DELETE transaction
export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const transactionId = searchParams.get('id')

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 })
    }

    // Get transaction details before deletion (for balance recalculation)
    const { rows: txnRows } = await pool.query(
      'SELECT account_id, amount, transaction_type, matched_member_id FROM transactions WHERE id = $1',
      [transactionId]
    )

    if (txnRows.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const transaction = txnRows[0]

    // Delete associated membership_payments first (if any)
    if (transaction.matched_member_id) {
      await pool.query(
        'DELETE FROM membership_payments WHERE transaction_id = $1',
        [transactionId]
      )
      console.log(`Deleted membership_payment records for transaction ${transactionId}`)
    }

    // Delete the transaction
    await pool.query('DELETE FROM transactions WHERE id = $1', [transactionId])

    // Update account balance
    // Reverse the transaction's effect on balance
    const balanceAdjustment = transaction.transaction_type === 'credit' 
      ? -Math.abs(transaction.amount) 
      : Math.abs(transaction.amount)

    const { rows: accountRows } = await pool.query(
      `UPDATE financial_accounts 
       SET current_balance = current_balance + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING current_balance`,
      [balanceAdjustment, transaction.account_id]
    )

    console.log(`Transaction ${transactionId} deleted successfully`)

    return NextResponse.json({ 
      success: true,
      newBalance: accountRows[0]?.current_balance
    })
  } catch (err: any) {
    console.error('Delete transaction error:', err)
    return NextResponse.json({ 
      error: 'Failed to delete transaction',
      details: err.message 
    }, { status: 500 })
  }
}

