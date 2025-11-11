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
        t.created_at,
        u.name as creator_name,
        m.name as matched_member_name
      FROM transactions t 
      LEFT JOIN users u ON t.created_by = u.id 
      LEFT JOIN users m ON t.matched_member_id = m.id
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
      matchedMemberId ? 'Member Payment' : 'Misc',
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

    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 })
    }

    // Update transaction with member match
    const { rows: updatedTransaction } = await pool.query(`
      UPDATE transactions 
      SET 
        matched_member_id = $1,
        category = CASE 
          WHEN $1 IS NOT NULL THEN 'Member Payment'
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
      [updatedTransaction[0].created_by]
    )

    return NextResponse.json({ 
      transaction: {
        ...updatedTransaction[0],
        creator_name: userRows[0]?.name || null,
        matched_member_name: matchedMemberName
      }
    })
  } catch (err: any) {
    console.error('Match transaction error:', err)
    return NextResponse.json({ error: 'Failed to match transaction' }, { status: 500 })
  }
}

