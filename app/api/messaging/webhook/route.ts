import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * Picky Assist Webhook Endpoint
 * 
 * URL to configure in Picky Assist: https://yourdomain.com/api/messaging/webhook
 * 
 * Actual Picky Assist payload format:
 * {
 *   "number": "61426967982",
 *   "message-in": "Hello",
 *   "message_in_raw": "Hello",
 *   "type": 1,
 *   "application": 121,
 *   "unique-id": "751403635",
 *   "project-id": 501326,
 *   "direction": 0,  // 0 = incoming, 1 = outgoing
 *   "name": "Elyas"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    console.log('📥 Webhook received:', JSON.stringify(body).substring(0, 500))

    // Check if this is an incoming message (direction: 0)
    // Picky Assist doesn't use "event" field - it sends message data directly
    // direction: 0 = incoming, direction: 1 = outgoing
    const isIncoming = body.direction === 0 || body.direction === '0'
    
    // Also check if there's a message - "message-in" or "message_in_raw"
    // Decode URL-encoded messages (Picky Assist sometimes sends them encoded)
    let messageText = body['message-in'] || body.message_in_raw || body.message || ''
    try {
      // Decode URL encoding (+ becomes space, %XX becomes character)
      messageText = decodeURIComponent(messageText.replace(/\+/g, ' '))
    } catch {
      // If decoding fails, use original text
    }
    
    if (!isIncoming && !messageText) {
      console.log(`⏭️ Ignoring: direction=${body.direction}, no message content`)
      return NextResponse.json({ 
        success: true, 
        message: 'Event ignored (not an incoming message)' 
      })
    }

    // Extract message details from Picky Assist format
    const fromPhone = body.number || 'unknown'
    const contactName = body.name || null
    const uniqueId = body['unique-id'] || body.unique_id || null
    const applicationId = body.application || null
    const projectId = body['project-id'] || body.project_id || null
    const messageType = body.type === 1 ? 'text' : (body.type === 2 ? 'image' : 'other')

    // Store in database
    const { rows } = await pool.query(`
      INSERT INTO incoming_messages (
        channel_id,
        from_phone,
        to_phone,
        message_type,
        message_text,
        contact_name,
        contact_phone,
        timestamp,
        raw_payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      uniqueId,  // Use unique-id as channel_id
      fromPhone,
      null,  // to_phone not provided in this format
      messageType,
      messageText,
      contactName,
      fromPhone,  // contact_phone same as from
      new Date().toISOString(),  // Current timestamp
      JSON.stringify(body)
    ])

    console.log(`✅ Message stored with ID: ${rows[0].id} from ${contactName || fromPhone}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Message received and stored',
      id: rows[0].id
    })
  } catch (err: any) {
    console.error('❌ Webhook error:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 })
  }
}

// Handle GET requests (for webhook verification if needed)
export async function GET(req: NextRequest) {
  // Some webhook systems send a GET request to verify the endpoint
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge') || searchParams.get('hub.challenge')
  
  if (challenge) {
    return new Response(challenge, { status: 200 })
  }
  
  return NextResponse.json({ 
    status: 'Webhook endpoint active',
    endpoint: '/api/messaging/webhook',
    method: 'POST',
    accepts: 'message.received events from Picky Assist'
  })
}

