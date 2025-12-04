import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

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
    const type = searchParams.get('type') || 'Event'

    const { rows } = await pool.query(`
      SELECT 
        id, 
        title, 
        description, 
        address, 
        to_char(event_date, 'YYYY-MM-DD') as event_date,
        start_time, 
        end_time, 
        event_type, 
        estimated_cost, 
        attendees,
        completed,
        completed_at
      FROM events 
      WHERE event_type = $1
      ORDER BY event_date ASC, start_time ASC 
      LIMIT 200
    `, [type])

    return NextResponse.json({ events: rows })
  } catch (err: any) {
    console.error('Get events error:', err)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

