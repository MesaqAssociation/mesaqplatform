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
    // Get the last organizing group from system settings
    const { rows: settingsRows } = await pool.query(`
      SELECT value FROM system_settings WHERE key = 'last_organizing_group'
    `)
    
    const lastGroup = settingsRows[0]?.value || null

    // Also get the most recent event's organizing group as fallback
    const { rows: eventRows } = await pool.query(`
      SELECT organizing_group 
      FROM events 
      WHERE organizing_group IS NOT NULL 
      ORDER BY event_date DESC, created_at DESC 
      LIMIT 1
    `)

    const lastEventGroup = eventRows[0]?.organizing_group || null

    return NextResponse.json({
      lastGroup: lastGroup || lastEventGroup,
      fromSettings: !!lastGroup,
      fromEvent: !lastGroup && !!lastEventGroup
    })
  } catch (err: any) {
    console.error('Get last organizing group error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
