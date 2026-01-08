import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// GET all groups
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
    // Try to get from member_groups table first
    // Count members by BOTH group_id and group_name to catch all cases
    const { rows: groups } = await pool.query(`
      SELECT 
        mg.id,
        mg.name,
        mg.description,
        mg.created_at,
        COUNT(u.id) as member_count
      FROM member_groups mg
      LEFT JOIN users u ON u.group_id = mg.id OR u.group_name = mg.name
      GROUP BY mg.id, mg.name, mg.description, mg.created_at
      ORDER BY mg.name ASC
    `)

    // If no groups found in member_groups table, fall back to unique group_name values
    if (groups.length === 0) {
      const { rows: legacyGroups } = await pool.query(`
        SELECT DISTINCT 
          group_name as name,
          COUNT(*) as member_count
        FROM users 
        WHERE group_name IS NOT NULL AND group_name != ''
        GROUP BY group_name
        ORDER BY group_name ASC
      `)
      
      return NextResponse.json({ 
        groups: legacyGroups.map(g => ({ id: null, name: g.name, member_count: parseInt(g.member_count), legacy: true }))
      })
    }

    return NextResponse.json({ groups })
  } catch (err: any) {
    // If member_groups table doesn't exist, fall back to unique group_name values
    console.log('Falling back to legacy group names:', err.message)
    try {
      const { rows: legacyGroups } = await pool.query(`
        SELECT DISTINCT 
          group_name as name,
          COUNT(*) as member_count
        FROM users 
        WHERE group_name IS NOT NULL AND group_name != ''
        GROUP BY group_name
        ORDER BY group_name ASC
      `)
      
      return NextResponse.json({ 
        groups: legacyGroups.map(g => ({ id: null, name: g.name, member_count: parseInt(g.member_count), legacy: true }))
      })
    } catch (fallbackErr) {
      console.error('Get groups error:', fallbackErr)
      return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 })
    }
  }
}

// POST create new group
export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    userId = decoded.userId || decoded.sub
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { rows: roleRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
  const role = (roleRows[0]?.role || '').toLowerCase()
  const canCreate = ['admin', 'board', 'manager', 'head'].includes(role)
  if (!canCreate) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, description, memberIds, leaderId } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    if (!leaderId) {
      return NextResponse.json({ error: 'Group leader is required' }, { status: 400 })
    }

    // Try to insert into member_groups table
    try {
      const { rows: newGroup } = await pool.query(
        `INSERT INTO member_groups (name, description)
         VALUES ($1, $2)
         RETURNING id, name, description, created_at`,
        [name.trim(), description?.trim() || null]
      )

      const groupId = newGroup[0].id
      const groupNameTrimmed = name.trim()

      // If memberIds provided, update those members to be in this group
      // Set BOTH group_id and group_name for compatibility
      if (memberIds && memberIds.length > 0) {
        await pool.query(
          `UPDATE users SET group_id = $1, group_name = $2, is_group_leader = false WHERE id = ANY($3::uuid[])`,
          [groupId, groupNameTrimmed, memberIds]
        )
      }

      // Set the leader - also set BOTH group_id and group_name
      await pool.query(
        `UPDATE users SET group_id = $1, group_name = $2, is_group_leader = true WHERE id = $3`,
        [groupId, groupNameTrimmed, leaderId]
      )

      return NextResponse.json({ 
        success: true,
        group: newGroup[0]
      })
    } catch (tableErr: any) {
      // If member_groups table doesn't exist, just update group_name directly on users
      console.log('member_groups table not found, using legacy mode')
      
      if (memberIds && memberIds.length > 0) {
        // Cast memberIds properly for text comparison with uuid column
        const placeholders = memberIds.map((_: string, i: number) => `$${i + 2}`).join(',')
        await pool.query(
          `UPDATE users SET group_name = $1, is_group_leader = false WHERE id::text IN (${placeholders})`,
          [name.trim(), ...memberIds]
        )
      }

      // Set the leader
      await pool.query(
        `UPDATE users SET group_name = $1, is_group_leader = true WHERE id = $2`,
        [name.trim(), leaderId]
      )

      return NextResponse.json({ 
        success: true,
        group: { id: null, name: name.trim(), legacy: true }
      })
    }
  } catch (err: any) {
    console.error('Create group error:', err)
    
    if (err.code === '23505') {
      return NextResponse.json({ error: 'A group with this name already exists' }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
}

// DELETE group
export async function DELETE(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    userId = decoded.userId || decoded.sub
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { rows: roleRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
  const role = (roleRows[0]?.role || '').toLowerCase()
  const canDelete = ['admin', 'board', 'manager', 'head'].includes(role)
  if (!canDelete) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { groupName, groupId } = body

    if (!groupName && !groupId) {
      return NextResponse.json({ error: 'Group ID or name is required' }, { status: 400 })
    }

    // Clear group_name and group_id from all users in this group
    if (groupName) {
      await pool.query(
        `UPDATE users SET group_name = NULL, group_id = NULL, is_group_leader = false WHERE group_name = $1`,
        [groupName]
      )
    }

    // Also delete from member_groups table if exists
    if (groupId) {
      try {
        await pool.query('DELETE FROM member_groups WHERE id = $1', [groupId])
      } catch {
        // Table might not exist
      }
    } else if (groupName) {
      try {
        await pool.query('DELETE FROM member_groups WHERE name = $1', [groupName])
      } catch {
        // Table might not exist
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete group error:', err)
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
  }
}
