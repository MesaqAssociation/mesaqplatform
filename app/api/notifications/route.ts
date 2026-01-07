import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// GET - List all notifications
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
    const { rows } = await pool.query(`
      SELECT 
        sn.id, 
        sn.title, 
        sn.message, 
        sn.scheduled_date, 
        sn.status, 
        sn.created_at,
        sn.sent_at,
        sn.recipients_count,
        sn.recipient_type,
        sn.recipient_ids,
        u.name as created_by_name
      FROM scheduled_notifications sn
      LEFT JOIN users u ON sn.created_by = u.id
      ORDER BY sn.scheduled_date DESC, sn.created_at DESC
    `)

    return NextResponse.json({ notifications: rows })
  } catch (err: any) {
    console.error('Get notifications error:', err)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

// POST - Create a new notification
export async function POST(req: NextRequest) {
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
    const { title, message, scheduled_date, recipient_type, recipient_ids } = await req.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    if (!scheduled_date) {
      return NextResponse.json({ error: 'Scheduled date is required' }, { status: 400 })
    }

    // recipient_type can be 'everyone' (default) or 'specific'
    // recipient_ids is an array of user IDs when recipient_type is 'specific'
    const type = recipient_type || 'everyone'
    const ids = type === 'specific' && Array.isArray(recipient_ids) ? recipient_ids : null

    // Ensure columns exist (will be created by migration, but safe fallback)
    try {
      await pool.query(`
        ALTER TABLE scheduled_notifications 
        ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(20) DEFAULT 'everyone',
        ADD COLUMN IF NOT EXISTS recipient_ids TEXT[]
      `)
    } catch {
      // Column might already exist, ignore
    }

    const { rows } = await pool.query(`
      INSERT INTO scheduled_notifications (title, message, scheduled_date, created_by, recipient_type, recipient_ids)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [title.trim(), message.trim(), scheduled_date, userId, type, ids])

    return NextResponse.json({ notification: rows[0] })
  } catch (err: any) {
    console.error('Create notification error:', err)
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}

// DELETE - Delete a notification (permanently remove from database)
export async function DELETE(req: NextRequest) {
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
    const id = searchParams.get('id')
    const action = searchParams.get('action') // 'cancel' or 'delete'

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 })
    }

    if (action === 'delete') {
      // Permanently delete the notification
      await pool.query('DELETE FROM scheduled_notifications WHERE id = $1', [id])
      return NextResponse.json({ success: true, action: 'deleted' })
    } else {
      // Default: cancel the notification (mark as cancelled)
    await pool.query(`
      UPDATE scheduled_notifications 
      SET status = 'cancelled' 
      WHERE id = $1 AND status = 'pending'
    `, [id])
      return NextResponse.json({ success: true, action: 'cancelled' })
    }
  } catch (err: any) {
    console.error('Delete notification error:', err)
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
  }
}
