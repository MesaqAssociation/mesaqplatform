import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ member_id: string }> | { member_id: string } }
) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    userId = decoded.userId || decoded.sub
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { rows: userRows } = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  )
  
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 403 })
  }
  
  const userRole = (userRows[0].role || '').toLowerCase()
  if (!['admin', 'board', 'manager', 'head'].includes(userRole)) {
    return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 })
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const memberId = resolvedParams.member_id
    
    const body = await req.json()
    const { password } = body

    // Validation
    if (!password || password.trim().length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update password_hash
    const { rows } = await pool.query(`
      UPDATE users 
      SET password_hash = $1
      WHERE id = $2
      RETURNING id, name
    `, [hashedPassword, memberId])

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true,
      message: `Password updated successfully for ${rows[0].name}`
    })
  } catch (error: any) {
    console.error('Error updating password:', error)
    return NextResponse.json({ 
      error: 'Failed to update password',
      details: error.message 
    }, { status: 500 })
  }
}
