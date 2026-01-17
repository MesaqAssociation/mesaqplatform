import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Helper to verify board auth
async function verifyBoardAuth(): Promise<{ userId: string; role: string } | null> {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) return null
  
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    const userId = decoded.userId || decoded.sub
    if (!userId) return null
    
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    const role = (rows[0]?.role || '').toLowerCase()
    
    if (!['admin', 'board', 'manager'].includes(role)) return null
    
    return { userId, role }
  } catch {
    return null
  }
}

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

// Delete a bank statement
export async function DELETE(req: NextRequest) {
  const auth = await verifyBoardAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized - Board access required' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const statementId = searchParams.get('id')

    if (!statementId) {
      return NextResponse.json({ error: 'Missing statement ID' }, { status: 400 })
    }

    // Get statement info before deleting
    const { rows: statementRows } = await pool.query(
      'SELECT id, file_name, statement_date_from, statement_date_to FROM bank_statements WHERE id = $1',
      [statementId]
    )

    if (statementRows.length === 0) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 })
    }

    const statement = statementRows[0]
    console.log(`🗑️ Deleting bank statement: ${statement.file_name} (${statement.statement_date_from} - ${statement.statement_date_to})`)

    // Delete the statement record (transactions should already be deleted manually)
    await pool.query('DELETE FROM bank_statements WHERE id = $1', [statementId])

    console.log(`✅ Deleted bank statement ${statementId}`)

    return NextResponse.json({ 
      success: true,
      message: `Deleted statement: ${statement.file_name}`
    })
  } catch (error: any) {
    console.error('Error deleting bank statement:', error)
    return NextResponse.json({ 
      error: 'Failed to delete bank statement',
      details: error.message 
    }, { status: 500 })
  }
}

