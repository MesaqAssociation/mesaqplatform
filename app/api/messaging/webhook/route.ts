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
 * Only processes "message.received" events and stores them in the database.
 * 
 * Example payload:
 * {
 *   "event": "message.received",
 *   "data": {
 *     "channel_id": "121",
 *     "from": "614XXXXXXXX",
 *     "to": "YOUR_WHATSAPP_NUMBER",
 *     "message": {
 *       "type": "text",
 *       "text": "Hi, I need help",
 *       "timestamp": "2025-01-02T10:45:12Z"
 *     },
 *     "contact": {
 *       "name": "Abdullah",
 *       "phone": "614XXXXXXXX"
 *     }
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    console.log('📥 Webhook received:', JSON.stringify(body).substring(0, 500))

    // Only process message.received events
    if (body.event !== 'message.received') {
      console.log(`⏭️ Ignoring event type: ${body.event}`)
      return NextResponse.json({ 
        success: true, 
        message: 'Event ignored (not message.received)' 
      })
    }

    const data = body.data
    if (!data) {
      console.log('⚠️ No data in webhook payload')
      return NextResponse.json({ 
        success: false, 
        error: 'No data in payload' 
      }, { status: 400 })
    }

    // Extract message details
    const channelId = data.channel_id || null
    const fromPhone = data.from || data.contact?.phone || 'unknown'
    const toPhone = data.to || null
    const messageType = data.message?.type || 'text'
    const messageText = data.message?.text || data.message?.caption || ''
    const contactName = data.contact?.name || null
    const contactPhone = data.contact?.phone || fromPhone
    const timestamp = data.message?.timestamp || new Date().toISOString()

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
      channelId,
      fromPhone,
      toPhone,
      messageType,
      messageText,
      contactName,
      contactPhone,
      timestamp,
      JSON.stringify(body)
    ])

    console.log(`✅ Message stored with ID: ${rows[0].id}`)

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

