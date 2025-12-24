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

/**
 * GET: Fetch incoming messages from database
 */
export async function GET(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
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
    const limit = parseInt(searchParams.get('limit') || '50')
    const unreadOnly = searchParams.get('unread') === 'true'

    // Fetch messages from database and try to match to members
    const query = `
      SELECT 
        im.id,
        im.from_phone as phone,
        im.message_text as message,
        im.contact_name,
        im.message_type as type,
        im.timestamp,
        im.read,
        im.created_at,
        u.id as member_id,
        u.name as member_name,
        u.member_id as member_code
      FROM incoming_messages im
      LEFT JOIN users u ON (
        -- Match by phone number (try various formats)
        REPLACE(REPLACE(REPLACE(u.phone, ' ', ''), '+', ''), '-', '') 
        LIKE '%' || RIGHT(REPLACE(REPLACE(REPLACE(im.from_phone, ' ', ''), '+', ''), '-', ''), 9)
        OR
        REPLACE(REPLACE(REPLACE(im.from_phone, ' ', ''), '+', ''), '-', '')
        LIKE '%' || RIGHT(REPLACE(REPLACE(REPLACE(u.phone, ' ', ''), '+', ''), '-', ''), 9)
      )
      ${unreadOnly ? 'WHERE im.read = false' : ''}
      ORDER BY im.timestamp DESC
      LIMIT $1
    `

    const { rows: messages } = await pool.query(query, [limit])

    // Format messages for display
    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id,
      phone: msg.phone,
      message: msg.message,
      contactName: msg.contact_name,
      timestamp: msg.timestamp,
      type: msg.type,
      read: msg.read,
      memberId: msg.member_id,
      memberName: msg.member_name,
      memberCode: msg.member_code
    }))

    return NextResponse.json({ 
      messages: formattedMessages,
      total: formattedMessages.length
    }, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Get incoming messages error:', err)
    
    // Check if table doesn't exist
    if (err.code === '42P01') {
      return NextResponse.json({ 
        messages: [],
        error: 'Table not created yet. Run supabase-incoming-messages.sql first.',
        total: 0
      }, { headers: corsHeaders })
    }
    
    return NextResponse.json({ 
      error: 'Failed to fetch messages',
      messages: [] 
    }, { status: 500, headers: corsHeaders })
  }
}

/**
 * PATCH: Mark message(s) as read
 */
export async function PATCH(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { messageId, markAllRead } = body

    if (markAllRead) {
      await pool.query('UPDATE incoming_messages SET read = true WHERE read = false')
      return NextResponse.json({ success: true, message: 'All messages marked as read' }, { headers: corsHeaders })
    }

    if (messageId) {
      await pool.query('UPDATE incoming_messages SET read = true WHERE id = $1', [messageId])
      return NextResponse.json({ success: true }, { headers: corsHeaders })
    }

    return NextResponse.json({ error: 'No messageId or markAllRead provided' }, { status: 400, headers: corsHeaders })
  } catch (err: any) {
    console.error('Mark read error:', err)
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500, headers: corsHeaders })
  }
}
