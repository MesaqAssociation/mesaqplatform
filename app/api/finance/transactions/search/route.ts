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
    const type = searchParams.get('type') || 'description' // 'description', 'name', 'amount'
    const query = searchParams.get('query')

    if (!accountId || !query) {
      return NextResponse.json({ transactions: [] })
    }

    let whereClause = ''
    let params: any[] = [accountId]

    switch (type) {
      case 'description':
        whereClause = `AND LOWER(t.description) LIKE LOWER($2)`
        params.push(`%${query}%`)
        break
      case 'name':
        whereClause = `AND LOWER(t.transaction_name) LIKE LOWER($2)`
        params.push(`%${query}%`)
        break
      case 'amount':
        // Search for exact amount or close matches
        const amountVal = parseFloat(query.replace(/[^0-9.-]/g, ''))
        if (isNaN(amountVal)) {
          return NextResponse.json({ transactions: [] })
        }
        whereClause = `AND ABS(t.amount) BETWEEN $2 AND $3`
        params.push(amountVal - 0.01, amountVal + 0.01)
        break
      default:
        whereClause = `AND LOWER(t.description) LIKE LOWER($2)`
        params.push(`%${query}%`)
    }

    const { rows: transactions } = await pool.query(`
      SELECT 
        t.id,
        to_char(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
        t.transaction_name,
        t.description,
        t.category,
        t.amount,
        t.transaction_type,
        t.reference,
        t.balance_after,
        t.source,
        t.matched_member_id,
        u.name as matched_member_name,
        t.statement_id,
        bs.file_name as statement_file_name,
        bs.file_url as statement_file_url
      FROM transactions t
      LEFT JOIN users u ON u.id = t.matched_member_id
      LEFT JOIN bank_statements bs ON bs.id = t.statement_id
      WHERE t.account_id = $1 ${whereClause}
      ORDER BY t.transaction_date DESC
      LIMIT 50
    `, params)

    return NextResponse.json({ transactions })
  } catch (err: any) {
    console.error('Search transactions error:', err)
    return NextResponse.json({ error: 'Search failed', details: err.message }, { status: 500 })
  }
}
