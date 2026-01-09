import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * Mobile Message Inbound Webhook Endpoint
 * 
 * URL to configure in Mobile Message: https://yourdomain.com/api/messaging/webhook
 * 
 * Expected payload format (may vary based on Mobile Message documentation):
 * {
 *   "from": "61412345678",
 *   "to": "your-number",
 *   "message": "Hello",
 *   "messageId": "abc123",
 *   "timestamp": "2026-01-09T12:00:00Z"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    console.log('📥 Inbound SMS webhook received:', JSON.stringify(body).substring(0, 500))

    // Extract message details from Mobile Message format
    const fromPhone = body.from || body.sender || body.number || 'unknown'
    const messageText = body.message || body.text || body.body || ''
    const messageId = body.messageId || body.id || body.reference || null
    const timestamp = body.timestamp || body.receivedAt || new Date().toISOString()

    if (!messageText) {
      console.log('⏭️ Ignoring: no message content')
      return NextResponse.json({ 
        success: true, 
        message: 'Event ignored (no message content)' 
      })
    }

    // Store in database
    const { rows } = await pool.query(`
      INSERT INTO incoming_messages (
        channel_id,
        from_phone,
        to_phone,
        message_type,
        message_text,
        media_url,
        contact_name,
        contact_phone,
        timestamp,
        raw_payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      messageId,  // Use messageId as channel_id
      fromPhone,
      body.to || null,
      'text',
      messageText,
      null,  // No media URL for SMS
      null,  // No contact name
      fromPhone,
      timestamp,
      JSON.stringify(body)
    ])

    console.log(`✅ Inbound SMS stored with ID: ${rows[0].id} from ${fromPhone}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Message received and stored',
      id: rows[0].id
    })
  } catch (err: any) {
    console.error('❌ Inbound webhook error:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 })
  }
}

// Handle GET requests (for webhook verification if needed)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge') || searchParams.get('hub.challenge')
  
  if (challenge) {
    return new Response(challenge, { status: 200 })
  }
  
  return NextResponse.json({ 
    status: 'Inbound SMS webhook endpoint active',
    endpoint: '/api/messaging/webhook',
    method: 'POST',
    accepts: 'Inbound SMS messages from Mobile Message'
  })
}
