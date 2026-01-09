import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { corsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cookieToken = cookies().get('auth_token')?.value
  const token = authHeader?.replace('Bearer ', '') || cookieToken
  
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'Event'
    const upcoming = searchParams.get('upcoming') === 'true'
    const limit = parseInt(searchParams.get('limit') || '200', 10)

    let query = `
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
        completed,
        completed_at
      FROM events 
      WHERE event_type = $1
    `
    
    // Only show upcoming (future) events if requested
    if (upcoming) {
      query += ` AND event_date >= CURRENT_DATE`
    }
    
    query += ` ORDER BY event_date ASC, start_time ASC LIMIT $2`

    const { rows } = await pool.query(query, [type, limit])

    return NextResponse.json({ events: rows }, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Get events error:', err)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500, headers: corsHeaders })
  }
}

