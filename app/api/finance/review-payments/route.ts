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
    // Get all transactions with category = 'Special Payment' that need review
    const { rows } = await pool.query(`
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
      WHERE t.category = 'Special Payment'
        AND t.transaction_type = 'credit'
        AND t.matched_member_id IS NOT NULL
      ORDER BY t.transaction_date DESC
      LIMIT 50
    `)

    return NextResponse.json({ payments: rows })
  } catch (err: any) {
    console.error('Get review payments error:', err)
    return NextResponse.json({ error: 'Failed to fetch payments for review' }, { status: 500 })
  }
}

