import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Get all bank statements
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

    let query = `
      SELECT 
        bs.id,
        bs.account_id,
        bs.file_name,
        bs.file_size,
        bs.file_type,
        bs.statement_date_from,
        bs.statement_date_to,
        bs.transaction_count,
        bs.uploaded_by,
        bs.uploaded_at,
        fa.account_name,
        u.name as uploaded_by_name
      FROM bank_statements bs
      LEFT JOIN financial_accounts fa ON bs.account_id = fa.id
      LEFT JOIN users u ON bs.uploaded_by = u.id
    `

    const params: any[] = []
    
    if (accountId) {
      query += ' WHERE bs.account_id = $1'
      params.push(accountId)
    }

    query += ' ORDER BY bs.uploaded_at DESC'

    const { rows } = await pool.query(query, params)

    return NextResponse.json({
      statements: rows
    })
  } catch (error: any) {
    console.error('Error fetching bank statements:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch bank statements',
      details: error.message 
    }, { status: 500 })
  }
}

