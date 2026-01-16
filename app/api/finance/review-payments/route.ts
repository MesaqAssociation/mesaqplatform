import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function GET(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all transactions with category = 'Special Payment' or 'Event Payment' that need review
    // Exclude transactions that have been marked as reviewed (reviewed_at IS NOT NULL)
    const { rows: payments } = await pool.query(`
      SELECT 
        t.id,
        t.transaction_date,
        t.transaction_name,
        t.description,
        t.amount,
        t.category,
        t.matched_member_id,
        m.name as member_name,
        m.member_id,
        fa.account_name
      FROM transactions t
      LEFT JOIN users m ON t.matched_member_id = m.id
      LEFT JOIN financial_accounts fa ON t.account_id = fa.id
      WHERE t.category IN ('Special Payment', 'Event Payment')
        AND t.transaction_type = 'credit'
        AND t.matched_member_id IS NOT NULL
        AND t.reviewed_at IS NULL
      ORDER BY t.transaction_date DESC
      LIMIT 50
    `)

    // Get all uncategorized debit transactions (expenses) that need review
    const { rows: expenses } = await pool.query(`
      SELECT 
        t.id,
        t.transaction_date,
        t.transaction_name,
        t.description,
        t.amount,
        t.category,
        fa.account_name
      FROM transactions t
      LEFT JOIN financial_accounts fa ON t.account_id = fa.id
      WHERE t.transaction_type = 'debit'
        AND (t.category IS NULL OR t.category = '' OR t.category = 'Expense')
      ORDER BY t.transaction_date DESC
      LIMIT 50
    `)

    return NextResponse.json({ payments, expenses })
  } catch (err: any) {
    console.error('Get review payments error:', err)
    return NextResponse.json({ error: 'Failed to fetch payments for review' }, { status: 500 })
  }
}

// POST - Mark a payment as reviewed (confirms it as special payment)
export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { transactionId } = body

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 })
    }

    // Mark the transaction as reviewed
    await pool.query(`
      UPDATE transactions 
      SET reviewed_at = NOW()
      WHERE id = $1
    `, [transactionId])

    return NextResponse.json({ success: true, message: 'Payment marked as reviewed' })
  } catch (err: any) {
    console.error('Mark payment reviewed error:', err)
    return NextResponse.json({ error: 'Failed to mark payment as reviewed' }, { status: 500 })
  }
}

