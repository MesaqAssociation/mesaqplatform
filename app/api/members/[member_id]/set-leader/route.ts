import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function POST(
  req: NextRequest,
  { params }: { params: { member_id: string } }
) {
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
    const memberId = params.member_id

    // Get the member's group
    const { rows: memberRows } = await pool.query(
      'SELECT group_name FROM users WHERE id = $1',
      [memberId]
    )

    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const groupName = memberRows[0].group_name

    if (!groupName) {
      return NextResponse.json({ error: 'Member is not in a group' }, { status: 400 })
    }

    // Start transaction
    await pool.query('BEGIN')

    try {
      // Remove leader status from all members in the group
      await pool.query(
        'UPDATE users SET is_group_leader = false WHERE group_name = $1',
        [groupName]
      )

      // Set this member as the leader
      await pool.query(
        'UPDATE users SET is_group_leader = true WHERE id = $1',
        [memberId]
      )

      await pool.query('COMMIT')

      return NextResponse.json({ 
        success: true,
        message: 'Group leader updated successfully'
      })
    } catch (err) {
      await pool.query('ROLLBACK')
      throw err
    }
  } catch (err: any) {
    console.error('Set leader error:', err)
    return NextResponse.json({ 
      error: 'Failed to set group leader',
      details: err.message 
    }, { status: 500 })
  }
}
