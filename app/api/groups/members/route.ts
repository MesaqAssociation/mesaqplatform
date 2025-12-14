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

    if (groupId) {
      // Query by group_id (new schema)
      const { rows } = await pool.query(`
        SELECT id, name FROM users 
        WHERE group_id = $1
        ORDER BY name ASC
      `, [groupId])
      members = rows
    }
    
    // If no results from group_id, try group_name (legacy)
    if (members.length === 0 && groupName) {
      const { rows } = await pool.query(`
        SELECT id, name FROM users 
        WHERE group_name = $1
        ORDER BY name ASC
      `, [groupName])
      members = rows
    }

    return NextResponse.json({ members })
  } catch (err: any) {
    console.error('Get group members error:', err)
    return NextResponse.json({ error: 'Failed to fetch group members' }, { status: 500 })
  }
}
