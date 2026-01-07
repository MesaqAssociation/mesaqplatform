import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * GET /api/messaging/conversations
 * Get list of all conversations (unique contacts with message history)
 */
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
    // Get all unique conversations by combining sent and incoming messages
    // Normalize phone numbers to last 9 digits for matching
    const { rows: conversations } = await pool.query(`
      WITH all_messages AS (
        -- Incoming messages
        SELECT 
          RIGHT(REGEXP_REPLACE(from_phone, '[^0-9]', '', 'g'), 9) as phone_key,
          from_phone as display_phone,
          contact_name,
          message_text as last_message,
          created_at as timestamp,
          'incoming' as direction,
          read,
          NULL::varchar as status
        FROM incoming_messages
        
        UNION ALL
        
        -- Sent messages
        SELECT 
          RIGHT(REGEXP_REPLACE(recipient_phone, '[^0-9]', '', 'g'), 9) as phone_key,
          recipient_phone as display_phone,
          recipient_name as contact_name,
          message_content as last_message,
          COALESCE(sent_at, created_at) as timestamp,
          'outgoing' as direction,
          true as read,
          status
        FROM sent_messages
      ),
      ranked_messages AS (
        SELECT 
          *,
          ROW_NUMBER() OVER (PARTITION BY phone_key ORDER BY timestamp DESC) as rn
        FROM all_messages
      ),
      conversation_stats AS (
        SELECT 
          phone_key,
          COUNT(*) FILTER (WHERE direction = 'incoming' AND read = false) as unread_count,
          COUNT(*) as total_messages
        FROM all_messages
        GROUP BY phone_key
      )
      SELECT 
        rm.phone_key,
        rm.display_phone,
        rm.contact_name,
        rm.last_message,
        rm.timestamp,
        rm.direction as last_direction,
        rm.status as last_status,
        cs.unread_count,
        cs.total_messages,
        u.id as member_id,
        u.name as member_name,
        u.member_id as member_code,
        u.image as member_image
      FROM ranked_messages rm
      JOIN conversation_stats cs ON cs.phone_key = rm.phone_key
      LEFT JOIN users u ON (
        -- Match last 9 digits, accounting for different formats (04xxx vs 614xxx)
        RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 9) = rm.phone_key
        OR RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 8) = RIGHT(rm.phone_key, 8)
      )
      WHERE rm.rn = 1
      ORDER BY rm.timestamp DESC
      LIMIT 100
    `)

    return NextResponse.json({
      conversations: conversations.map(c => ({
        phoneKey: c.phone_key,
        displayPhone: c.display_phone,
        contactName: c.contact_name || c.member_name,
        memberId: c.member_id,
        memberName: c.member_name,
        memberCode: c.member_code,
        memberImage: c.member_image,
        lastMessage: c.last_message?.substring(0, 100) + (c.last_message?.length > 100 ? '...' : ''),
        lastTimestamp: c.timestamp,
        lastDirection: c.last_direction,
        lastStatus: c.last_status,
        unreadCount: parseInt(c.unread_count) || 0,
        totalMessages: parseInt(c.total_messages) || 0
      }))
    })
  } catch (err: any) {
    console.error('Get conversations error:', err)
    return NextResponse.json({ 
      error: 'Failed to fetch conversations',
      details: err.message 
    }, { status: 500 })
  }
}

