/**
 * Grants API
 * 
 * Manage grant sources and discovered grants
 */

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// GET - List grant sources and discovered grants
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

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'sources'
  
  try {
    if (type === 'sources') {
      // Get grant sources
      const { rows: sources } = await pool.query(`
        SELECT 
          id, name, url, source_type, entity, is_active, 
          check_frequency_hours, last_checked_at, keywords, notes,
          created_at
        FROM grant_sources
        ORDER BY source_type, name
      `)
      
      return NextResponse.json({ sources })
    }
    
    if (type === 'discovered') {
      // Get discovered grants
      const eligibleOnly = searchParams.get('eligible') === 'true'
      
      let query = `
        SELECT 
          dg.id, dg.title, dg.description, dg.url, dg.opens_at, dg.closes_at,
          dg.grant_amount, dg.eligibility_notes, dg.ai_eligibility_score,
          dg.ai_eligibility_reason, dg.is_eligible, dg.is_notified, 
          dg.notified_at, dg.first_seen_at,
          gs.name as source_name, gs.entity as source_entity
        FROM discovered_grants dg
        JOIN grant_sources gs ON dg.source_id = gs.id
      `
      
      if (eligibleOnly) {
        query += ` WHERE dg.is_eligible = true`
      }
      
      query += ` ORDER BY dg.first_seen_at DESC LIMIT 100`
      
      const { rows: grants } = await pool.query(query)
      
      return NextResponse.json({ grants })
    }
    
    if (type === 'profile') {
      // Get community profile
      const { rows } = await pool.query('SELECT profile_key, profile_value FROM community_profile')
      
      const profile: Record<string, string> = {}
      for (const row of rows) {
        profile[row.profile_key] = row.profile_value
      }
      
      return NextResponse.json({ profile })
    }
    
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    
  } catch (err: any) {
    console.error('Grants API error:', err)
    return NextResponse.json({ error: 'Failed to fetch grants data' }, { status: 500 })
  }
}

// POST - Add new grant source
export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let decoded: any
  try {
    decoded = jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Only managers can add sources
  const userId = decoded.userId || decoded.sub
  const { rows: userRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
  
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 403 })
  }
  
  const userRole = (userRows[0].role || '').toLowerCase()
  if (!['admin', 'manager', 'head'].includes(userRole)) {
    return NextResponse.json({ error: 'Unauthorized - Managers only' }, { status: 403 })
  }
  
  try {
    const body = await req.json()
    const { name, url, source_type, entity, keywords, notes } = body
    
    if (!name || !url) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 })
    }
    
    const { rows: newSource } = await pool.query(`
      INSERT INTO grant_sources (name, url, source_type, entity, keywords, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, url, source_type || 'general', entity, keywords || [], notes])
    
    return NextResponse.json({ 
      success: true,
      source: newSource[0]
    })
    
  } catch (err: any) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'This URL is already being monitored' }, { status: 400 })
    }
    console.error('Add grant source error:', err)
    return NextResponse.json({ error: 'Failed to add grant source' }, { status: 500 })
  }
}

// PATCH - Update grant source or community profile
export async function PATCH(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let decoded: any
  try {
    decoded = jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Only managers can update
  const userId = decoded.userId || decoded.sub
  const { rows: userRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
  
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 403 })
  }
  
  const userRole = (userRows[0].role || '').toLowerCase()
  if (!['admin', 'manager', 'head'].includes(userRole)) {
    return NextResponse.json({ error: 'Unauthorized - Managers only' }, { status: 403 })
  }
  
  try {
    const body = await req.json()
    
    // Update community profile
    if (body.type === 'profile') {
      for (const [key, value] of Object.entries(body.profile || {})) {
        await pool.query(`
          INSERT INTO community_profile (profile_key, profile_value)
          VALUES ($1, $2)
          ON CONFLICT (profile_key) DO UPDATE SET 
            profile_value = EXCLUDED.profile_value,
            updated_at = NOW()
        `, [key, value])
      }
      
      return NextResponse.json({ success: true })
    }
    
    // Update grant source
    if (body.sourceId) {
      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1
      
      if (body.name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(body.name)
      }
      if (body.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`)
        values.push(body.is_active)
      }
      if (body.keywords !== undefined) {
        updates.push(`keywords = $${paramIndex++}`)
        values.push(body.keywords)
      }
      if (body.notes !== undefined) {
        updates.push(`notes = $${paramIndex++}`)
        values.push(body.notes)
      }
      
      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`)
        values.push(body.sourceId)
        
        await pool.query(`
          UPDATE grant_sources 
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
        `, values)
      }
      
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    
  } catch (err: any) {
    console.error('Update grants error:', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

// DELETE - Remove grant source
export async function DELETE(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let decoded: any
  try {
    decoded = jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Only managers can delete
  const userId = decoded.userId || decoded.sub
  const { rows: userRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
  
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 403 })
  }
  
  const userRole = (userRows[0].role || '').toLowerCase()
  if (!['admin', 'manager', 'head'].includes(userRole)) {
    return NextResponse.json({ error: 'Unauthorized - Managers only' }, { status: 403 })
  }
  
  const { searchParams } = new URL(req.url)
  const sourceId = searchParams.get('id')
  
  if (!sourceId) {
    return NextResponse.json({ error: 'Source ID required' }, { status: 400 })
  }
  
  try {
    await pool.query('DELETE FROM grant_sources WHERE id = $1', [sourceId])
    
    return NextResponse.json({ success: true })
    
  } catch (err: any) {
    console.error('Delete grant source error:', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}

