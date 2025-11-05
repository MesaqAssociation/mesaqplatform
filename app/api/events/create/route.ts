import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function POST(req: NextRequest) {
  // Verify admin
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
    const { 
      title, 
      description,
      address,
      attendees, 
      estimated_cost, 
      event_date, 
      start_time, 
      end_time, 
      email_attendees, 
      event_type,
      agenda 
    } = body

    if (!title || !event_date || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Insert event
    const result = await pool.query(
      `INSERT INTO events (
        id, 
        title, 
        description,
        address,
        event_type, 
        event_date, 
        start_time, 
        end_time, 
        estimated_cost, 
        email_attendees,
        attendees,
        agenda
      ) VALUES (
        gen_random_uuid(), 
        $1, 
        $2, 
        $3,
        $4, 
        $5, 
        $6, 
        $7, 
        $8, 
        $9, 
        $10,
        $11
      ) RETURNING id, title, event_type, event_date`,
      [
        title, 
        description || null,
        address || null,
        event_type || 'Event', 
        event_date, 
        start_time, 
        end_time, 
        estimated_cost ? parseFloat(estimated_cost) : null, 
        email_attendees || false,
        JSON.stringify(attendees || []),
        JSON.stringify(agenda || [])
      ]
    )
    
    return NextResponse.json({ event: result.rows[0] })
  } catch (err: any) {
    console.error('Create event error:', err)
    return NextResponse.json({ 
      error: err.message || 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}

