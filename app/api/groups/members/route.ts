import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// GET members of a specific group
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
    const groupName = searchParams.get('name')
    const groupId = searchParams.get('id')

    if (!groupName && !groupId) {
      return NextResponse.json({ members: [] })
    }

    let members: Array<{ id: string, name: string }> = []

    // Query by BOTH group_id AND group_name to catch all cases
    // Some users may have group_id set, others may have group_name
    if (groupId && groupName) {
      const { rows } = await pool.query(`
        SELECT id, name, COALESCE(is_group_leader, false) as is_group_leader FROM users 
        WHERE group_id = $1 OR group_name = $2
        ORDER BY is_group_leader DESC, name ASC
      `, [groupId, groupName])
      members = rows
    } else if (groupId) {
      // Query by group_id only
      const { rows } = await pool.query(`
        SELECT id, name, COALESCE(is_group_leader, false) as is_group_leader FROM users 
        WHERE group_id = $1
        ORDER BY is_group_leader DESC, name ASC
      `, [groupId])
      members = rows
    } else if (groupName) {
      // Query by group_name only (legacy)
      const { rows } = await pool.query(`
        SELECT id, name, COALESCE(is_group_leader, false) as is_group_leader FROM users 
        WHERE group_name = $1
        ORDER BY is_group_leader DESC, name ASC
      `, [groupName])
      members = rows
    }

    return NextResponse.json({ members })
  } catch (err: any) {
    console.error('Get group members error:', err)
    return NextResponse.json({ error: 'Failed to fetch group members' }, { status: 500 })
  }
}
