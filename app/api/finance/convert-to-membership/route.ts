import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

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

  let decoded: any
  try {
    decoded = jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins/board can convert transactions
  const userId = decoded.userId || decoded.sub
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { rows: userRows } = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  )
  
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 403 })
  }
  
  const userRole = (userRows[0].role || '').toLowerCase()
  if (!['admin', 'board', 'manager'].includes(userRole)) {
    return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { transactionId, memberId, amount, transactionDate } = body

    if (!transactionId || !memberId || !amount || !transactionDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the transaction date's month for the membership payment
    const txnDate = new Date(transactionDate + 'T00:00:00')
    const paymentMonth = new Date(txnDate.getFullYear(), txnDate.getMonth(), 1)
    const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

    // Get monthly fee from system settings
    const { rows: feeRows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
    )
    const monthlyFee = parseFloat(feeRows[0]?.value || '40.00')

    // Insert membership payment
    await pool.query(`
      INSERT INTO membership_payments (user_id, payment_month, amount, transaction_id, payment_date, status)
      VALUES ($1, $2, $3, $4, $5, 'paid')
      ON CONFLICT (user_id, payment_month) DO UPDATE
      SET amount = membership_payments.amount + EXCLUDED.amount,
          transaction_id = EXCLUDED.transaction_id,
          payment_date = EXCLUDED.payment_date
    `, [memberId, paymentMonthStr, amount, transactionId, transactionDate])

    const monthName = txnDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

    return NextResponse.json({
      success: true,
      monthName,
      message: `Transaction converted to membership payment for ${monthName}`
    })

  } catch (err: any) {
    console.error('Convert to membership error:', err)
    return NextResponse.json({
      error: 'Failed to convert transaction',
      details: err.message
    }, { status: 500 })
  }
}

