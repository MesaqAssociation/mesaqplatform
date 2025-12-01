import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { Pool } from 'pg'

export async function POST(
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

    const body = await req.json()
    const { summary, finalCost, files } = body

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
    })

    // Update event with completion details
    await pool.query(
      `UPDATE events 
       SET 
         completed = true,
         completed_at = NOW(),
         completion_summary = $1,
         final_cost = $2,
         completion_files = $3
       WHERE id = $4`,
      [summary, finalCost, JSON.stringify(files || []), params.event_id]
    )

    // Get user name for audit log
    const { rows: userRows } = await pool.query(
      'SELECT name FROM users WHERE id = $1',
      [userId]
    )
    const userName = userRows[0]?.name || 'Unknown'

    // Audit log removed - logs system no longer in use

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error completing event:', error)
    return NextResponse.json(
      { error: 'Failed to complete event' },
      { status: 500 }
    )
  }
}

