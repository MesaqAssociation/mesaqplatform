import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function DELETE(
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
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Await params if it's a Promise
    const resolvedParams = params instanceof Promise ? await params : params
    const memberId = resolvedParams.member_id // UUID string

    // Only admins/board/officers can delete
    const { rows: roleRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    const role = (roleRows[0]?.role || '').toLowerCase()
    const canDelete = ['admin','board','manager','head','finance officer','logistics officer','public officer'].includes(role)
    if (!canDelete) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get member info before deleting
    const { rows: memberRows } = await pool.query(
      'SELECT id, name, email, phone FROM users WHERE id = $1',
      [memberId]
    )

    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const member = memberRows[0]

    // Delete member (cascade will handle related records)
    await pool.query('DELETE FROM users WHERE id = $1', [memberId])

    // Audit log removed - logs system no longer in use

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete member error:', err)
    return NextResponse.json({ 
      error: 'Failed to delete member' 
    }, { status: 500 })
  }
}

