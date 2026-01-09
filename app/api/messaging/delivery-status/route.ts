import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * Mobile Message Outbound Status Webhook Endpoint
 * 
 * URL to configure in Mobile Message: https://yourdomain.com/api/messaging/delivery-status
 * 
 * Expected payload format (may vary based on Mobile Message documentation):
 * {
 *   "messageId": "abc123",
 *   "status": "delivered" | "failed" | "sent",
 *   "to": "61412345678",
 *   "timestamp": "2026-01-09T12:00:00Z",
 *   "error": "Error message if failed"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    console.log('📬 Delivery status webhook received:', JSON.stringify(body).substring(0, 500))

    const messageId = body.messageId || body.id || body.reference
    const status = body.status || body.deliveryStatus
    const errorMessage = body.error || body.errorMessage || body.failureReason || null

    if (!messageId) {
      console.log('⏭️ Ignoring: no message ID')
      return NextResponse.json({ 
        success: true, 
        message: 'Event ignored (no message ID)' 
      })
    }

    // Update sent message status in database if we track it
    // Note: We may need to store message IDs from Mobile Message response
    // to match them back to our sent_messages table
    try {
      await pool.query(`
        UPDATE sent_messages 
        SET 
          status = $1,
          error_message = $2,
          updated_at = NOW()
        WHERE external_message_id = $3
      `, [
        status === 'delivered' ? 'delivered' : status === 'failed' ? 'failed' : 'sent',
        errorMessage,
        messageId
      ])
      console.log(`✅ Updated status for message ${messageId}: ${status}`)
    } catch (updateErr) {
      // Table might not have external_message_id column, or message not found
      console.log(`ℹ️ Could not update status for message ${messageId}:`, updateErr)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Status update received',
      messageId,
      status
    })
  } catch (err: any) {
    console.error('❌ Delivery status webhook error:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 })
  }
}

// Handle GET requests (for webhook verification if needed)
export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    status: 'Delivery status webhook endpoint active',
    endpoint: '/api/messaging/delivery-status',
    method: 'POST',
    accepts: 'Outbound SMS delivery status updates from Mobile Message'
  })
}
