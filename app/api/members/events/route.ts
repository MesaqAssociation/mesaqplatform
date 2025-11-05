import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Add event attendance
export async function POST(req: NextRequest) {
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
    const body = await req.json()
    const { userId, eventId } = body

    await pool.query(
      `INSERT INTO member_events (user_id, event_id, attended) 
       VALUES ($1, $2, true) 
       ON CONFLICT (user_id, event_id) DO NOTHING`,
      [userId, eventId]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Add event error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Remove event attendance
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
    const body = await req.json()
    const { userId, eventId } = body

    await pool.query(
      'DELETE FROM member_events WHERE user_id = $1 AND event_id = $2',
      [userId, eventId]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Remove event error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

