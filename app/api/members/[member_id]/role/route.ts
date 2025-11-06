import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

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
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    userId = decoded.sub
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Await params if it's a Promise
    const resolvedParams = params instanceof Promise ? await params : params
    const memberId = parseInt(resolvedParams.member_id)

    if (isNaN(memberId)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 })
    }

    const { role } = await req.json()

    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }

    // Validate role
    const validRoles = ['Community Member', 'Manager', 'Public Officer', 'Finance Officer', 'Logistics Officer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Update role
    const { rows } = await pool.query(
      'UPDATE users SET role = $1 WHERE member_id = $2 RETURNING id, name, role',
      [role, memberId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Log the action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES ($1, 'role_change', 'user', $2, $3)`,
      [userId, rows[0].id, JSON.stringify({ oldRole: role, newRole: role, memberName: rows[0].name })]
    )

    return NextResponse.json({ success: true, member: rows[0] })
  } catch (err: any) {
    console.error('Update role error:', err)
    return NextResponse.json({ 
      error: 'Failed to update role' 
    }, { status: 500 })
  }
}

