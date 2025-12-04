import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Helper function to verify auth and check if user is board/head
async function verifyBoardAuth(): Promise<{ userId: string; role: string } | null> {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return null
  }
  
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    
    // Get user role
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.sub])
    if (rows.length === 0) return null
    
    const role = rows[0].role
    
    // Only allow board, admin, and Manager roles
    if (!['board', 'admin', 'Manager'].includes(role)) {
      return null
    }
    
    return { userId: decoded.sub, role }
  } catch {
    return null
  }
}

// GET - List all keywords
export async function GET(req: NextRequest) {
  const auth = await verifyBoardAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { rows } = await pool.query(`
      SELECT k.id, k.keyword, k.description, k.created_at, u.name as created_by_name
      FROM payment_keywords k
      LEFT JOIN users u ON k.created_by = u.id
      ORDER BY k.keyword ASC
    `)

    return NextResponse.json({ keywords: rows })
  } catch (err: any) {
    console.error('Get keywords error:', err)
    return NextResponse.json({ error: 'Failed to fetch keywords' }, { status: 500 })
  }
}

// POST - Add new keyword
export async function POST(req: NextRequest) {
  const auth = await verifyBoardAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { keyword, description } = body

    if (!keyword || !keyword.trim()) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 })
    }

    const { rows } = await pool.query(`
      INSERT INTO payment_keywords (keyword, description, created_by)
      VALUES ($1, $2, $3)
      RETURNING id, keyword, description, created_at
    `, [keyword.trim().toLowerCase(), description || null, auth.userId])

    return NextResponse.json({ keyword: rows[0] })
  } catch (err: any) {
    console.error('Create keyword error:', err)
    
    // Handle unique constraint violation
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Keyword already exists' }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Failed to create keyword' }, { status: 500 })
  }
}

// DELETE - Remove keyword
export async function DELETE(req: NextRequest) {
  const auth = await verifyBoardAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Keyword ID is required' }, { status: 400 })
    }

    await pool.query('DELETE FROM payment_keywords WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete keyword error:', err)
    return NextResponse.json({ error: 'Failed to delete keyword' }, { status: 500 })
  }
}

