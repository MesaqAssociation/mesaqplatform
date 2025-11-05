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
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    userId = decoded.sub
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { accountId, newBalance, reason } = body

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
    }

    // Get current balance
    const { rows: accounts } = await pool.query(
      'SELECT current_balance FROM financial_accounts WHERE id = $1',
      [accountId]
    )
    const oldBalance = accounts[0]?.current_balance || 0

    // Update balance
    await pool.query(
      'UPDATE financial_accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, accountId]
    )

    // Create adjustment transaction
    const difference = newBalance - oldBalance
    const { rows } = await pool.query(
      `INSERT INTO transactions 
       (account_id, transaction_date, description, amount, transaction_type, balance_after, created_by, source) 
       VALUES ($1, CURRENT_DATE, $2, $3, 'adjustment', $4, $5, 'manual') 
       RETURNING *`,
      [accountId, `Balance Adjustment: ${reason}`, difference, newBalance, userId]
    )

    // Log the action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES ($1, 'balance_adjustment', 'transaction', $2, $3)`,
      [userId, rows[0].id, JSON.stringify({ oldBalance, newBalance, reason })]
    )

    return NextResponse.json({ transaction: rows[0] })
  } catch (err: any) {
    console.error('Adjust balance error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

