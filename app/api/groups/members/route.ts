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

    console.log('🔍 Fetching members for group:', { groupId, groupName })

    if (!groupName && !groupId) {
      return NextResponse.json({ members: [] })
    }

    let members: Array<{ id: string, name: string }> = []

    // Query members based on group ID or group name
    // Use DISTINCT to avoid duplicates if user matches both conditions
    if (groupId) {
      // Primary: Query by group_id (new schema)
      const { rows } = await pool.query(`
        SELECT DISTINCT id, name, COALESCE(is_group_leader, false) as is_group_leader FROM users 
        WHERE group_id = $1
        ORDER BY is_group_leader DESC, name ASC
      `, [groupId])
      members = rows
      console.log(`  Found ${members.length} members by group_id`)
      
      // If no results and we have a name, fallback to group_name
      if (members.length === 0 && groupName) {
        const { rows: legacyRows } = await pool.query(`
          SELECT DISTINCT id, name, COALESCE(is_group_leader, false) as is_group_leader FROM users 
          WHERE group_name = $1 AND (group_id IS NULL OR group_id != $2)
          ORDER BY is_group_leader DESC, name ASC
        `, [groupName, groupId])
        members = legacyRows
        console.log(`  Found ${members.length} members by group_name (fallback)`)
      }
    } else if (groupName) {
      // Legacy: Query by group_name only
      const { rows } = await pool.query(`
        SELECT DISTINCT id, name, COALESCE(is_group_leader, false) as is_group_leader FROM users 
        WHERE group_name = $1
        ORDER BY is_group_leader DESC, name ASC
      `, [groupName])
      members = rows
      console.log(`  Found ${members.length} members by group_name only`)
    }

    return NextResponse.json({ members })
  } catch (err: any) {
    console.error('Get group members error:', err)
    return NextResponse.json({ error: 'Failed to fetch group members' }, { status: 500 })
  }
}
