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
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json({ members: [], events: [], meetings: [] })
    }

    const searchPattern = `%${query}%`

    // Search members
    const { rows: members } = await pool.query(`
      SELECT 
        'member' as type,
        member_id as id,
        name,
        email,
        phone,
        role
      FROM users 
      WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1
      ORDER BY name ASC
      LIMIT 5
    `, [searchPattern])

    // Search events (not meetings)
    const { rows: events } = await pool.query(`
      SELECT 
        'event' as type,
        id,
        title,
        to_char(event_date, 'YYYY-MM-DD') as event_date,
        location,
        event_type
      FROM events 
      WHERE (title ILIKE $1 OR description ILIKE $1)
        AND event_type = 'event'
      ORDER BY event_date DESC
      LIMIT 5
    `, [searchPattern])

    // Search meetings
    const { rows: meetings } = await pool.query(`
      SELECT 
        'meeting' as type,
        id,
        title,
        to_char(event_date, 'YYYY-MM-DD') as event_date,
        location,
        event_type
      FROM events 
      WHERE (title ILIKE $1 OR description ILIKE $1)
        AND event_type = 'meeting'
      ORDER BY event_date DESC
      LIMIT 5
    `, [searchPattern])

    return NextResponse.json({ 
      members, 
      events, 
      meetings,
      query 
    })
  } catch (error: any) {
    console.error('Search error:', error)
    return NextResponse.json({ 
      error: 'Search failed',
      details: error.message 
    }, { status: 500 })
  }
}

