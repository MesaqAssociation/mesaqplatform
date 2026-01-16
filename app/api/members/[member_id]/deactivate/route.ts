import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Verify admin/board access
async function verifyAdmin(): Promise<string | null> {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) return null
  
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    const userId = decoded.userId || decoded.sub
    
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    if (rows.length === 0) return null
    
    const role = (rows[0].role || '').toLowerCase()
    const adminRoles = ['admin', 'board', 'manager', 'head', 'finance officer']
    if (!adminRoles.includes(role)) return null
    
    return userId
  } catch {
    return null
  }
}

// POST - Deactivate a member
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ member_id: string }> | { member_id: string } }
) {
  const adminId = await verifyAdmin()
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Await params if it's a Promise (Next.js 15+)
  const resolvedParams = params instanceof Promise ? await params : params
  const memberId = resolvedParams.member_id

  try {
    // Check if member exists
    const { rows: existing } = await pool.query(
      'SELECT id, name, is_active FROM users WHERE id = $1',
      [memberId]
    )

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Don't allow deactivating yourself
    if (memberId === adminId) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
    }

    // Toggle is_active status
    const currentlyActive = existing[0].is_active !== false // Default to true if null
    const newStatus = !currentlyActive

    await pool.query(
      'UPDATE users SET is_active = $1 WHERE id = $2',
      [newStatus, memberId]
    )

    return NextResponse.json({ 
      success: true, 
      is_active: newStatus,
      message: newStatus ? 'Member account reactivated' : 'Member account deactivated'
    })
  } catch (err) {
    console.error('Deactivate member error:', err)
    return NextResponse.json({ error: 'Failed to update member status' }, { status: 500 })
  }
}

