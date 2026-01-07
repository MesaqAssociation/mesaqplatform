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
 * GET /api/messaging/conversations/[phoneKey]
 * Get all messages for a specific conversation
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { phoneKey: string } }
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
    const { phoneKey } = params
    const { searchParams } = new URL(req.url)
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const before = searchParams.get('before') // ISO timestamp for pagination

    // Get contact info - match with flexible phone format
    const { rows: contactRows } = await pool.query(`
      SELECT 
        u.id as member_id,
        u.name as member_name,
        u.member_id as member_code,
        u.phone,
        u.email,
        u.image
      FROM users u
      WHERE RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 9) = $1
         OR RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 8) = RIGHT($1, 8)
      LIMIT 1
    `, [phoneKey])

    const contact = contactRows[0] || null

    // Get messages for this conversation
    let beforeClause = ''
    const queryParams: any[] = [phoneKey, limit]
    
    if (before) {
      beforeClause = 'AND timestamp < $3'
      queryParams.push(before)
    }

    const { rows: messages } = await pool.query(`
      WITH all_messages AS (
        -- Incoming messages
        SELECT 
          id::text,
          RIGHT(REGEXP_REPLACE(from_phone, '[^0-9]', '', 'g'), 9) as phone_key,
          from_phone as display_phone,
          contact_name,
          message_text as message,
          NULL::varchar as message_type,
          media_url,
          message_type as media_type,
          created_at as timestamp,
          'incoming' as direction,
          read,
          NULL::varchar as status,
          NULL::text as error_message
        FROM incoming_messages
        
        UNION ALL
        
        -- Sent messages
        SELECT 
          id::text,
          RIGHT(REGEXP_REPLACE(recipient_phone, '[^0-9]', '', 'g'), 9) as phone_key,
          recipient_phone as display_phone,
          recipient_name as contact_name,
          message_content as message,
          message_type::varchar,
          NULL::text as media_url,
          NULL::varchar as media_type,
          COALESCE(sent_at, created_at) as timestamp,
          'outgoing' as direction,
          true as read,
          status::varchar,
          error_message
        FROM sent_messages
      )
      SELECT *
      FROM all_messages
      WHERE phone_key = $1
      ${beforeClause}
      ORDER BY timestamp DESC
      LIMIT $2
    `, queryParams)

    // Mark incoming messages as read
    await pool.query(`
      UPDATE incoming_messages 
      SET read = true 
      WHERE RIGHT(REGEXP_REPLACE(from_phone, '[^0-9]', '', 'g'), 9) = $1 
        AND read = false
    `, [phoneKey])

    // Reverse to get chronological order (oldest first in the returned array)
    const chronologicalMessages = messages.reverse()

    // Helper to clean attachment placeholder text
    const cleanMessage = (msg: string | null) => {
      if (!msg) return ''
      // Remove [Image attachment], [Media attachment], etc.
      return msg.replace(/\[(Image|Video|Audio|Document|Media) attachment\]/gi, '').trim()
    }

    return NextResponse.json({
      contact,
      messages: chronologicalMessages.map(m => ({
        id: m.id,
        message: cleanMessage(m.message),
        messageType: m.message_type,
        mediaUrl: m.media_url,
        mediaType: m.media_type,
        timestamp: m.timestamp,
        direction: m.direction,
        status: m.status,
        errorMessage: m.error_message
      })),
      hasMore: messages.length === limit,
      oldestTimestamp: chronologicalMessages[0]?.timestamp || null
    })
  } catch (err: any) {
    console.error('Get conversation messages error:', err)
    return NextResponse.json({ 
      error: 'Failed to fetch messages',
      details: err.message 
    }, { status: 500 })
  }
}

