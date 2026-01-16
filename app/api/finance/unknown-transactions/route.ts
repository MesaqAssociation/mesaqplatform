import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Verify admin/board access
async function verifyBoardAuth(): Promise<{ userId: string } | null> {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) return null
  
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    const userId = decoded.userId || decoded.sub
    
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    if (rows.length === 0) return null
    
    const role = (rows[0].role || '').toLowerCase()
    const adminRoles = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer']
    if (!adminRoles.includes(role)) return null
    
    return { userId }
  } catch {
    return null
  }
}

// GET - Get all unknown transactions (credits without matched member)
export async function GET(req: NextRequest) {
  const auth = await verifyBoardAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { rows } = await pool.query(`
      SELECT 
        t.id,
        to_char(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
        t.transaction_name,
        t.description,
        t.amount,
        t.transaction_type,
        t.category,
        t.balance_after,
        t.source,
        fa.account_name
      FROM transactions t
      LEFT JOIN financial_accounts fa ON fa.id = t.account_id
      WHERE t.transaction_type = 'credit'
        AND t.matched_member_id IS NULL
        AND t.category != 'Charges'
        AND t.reviewed_at IS NULL
      ORDER BY t.transaction_date DESC
    `)

    return NextResponse.json({ transactions: rows })
  } catch (err) {
    console.error('Get unknown transactions error:', err)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

