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
        t.created_at,
        u.name as creator_name 
      FROM transactions t 
      LEFT JOIN users u ON t.created_by = u.id 
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

