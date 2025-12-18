import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { Pool } from 'pg'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// DELETE - Delete an event
export async function DELETE(
  req: NextRequest,
  { params }: { params: { event_id: string } }
) {
  try {
    // Verify authentication
    const token = cookies().get('auth_token')?.value
    if (!token || !process.env.AUTH_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let userId: string
    try {
      const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
      userId = decoded.sub
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user is admin/board
    const { rows: roleRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    const role = (roleRows[0]?.role || '').toLowerCase()
    const canDelete = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer'].includes(role)
    
    if (!canDelete) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete related records first
    await pool.query('DELETE FROM member_events WHERE event_id = $1', [params.event_id])
    
    // Delete the event
    const { rowCount } = await pool.query('DELETE FROM events WHERE id = $1', [params.event_id])

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}

