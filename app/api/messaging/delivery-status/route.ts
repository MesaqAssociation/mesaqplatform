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
    
    console.log('📬 Delivery status webhook received:', JSON.stringify(body))

    // Mobile Message uses message_id (with underscore)
    const messageId = body.message_id || body.messageId || body.id || body.reference
    const status = body.status || body.deliveryStatus
    const errorMessage = body.error || body.errorMessage || body.failureReason || null
    const recipientPhone = body.to

    if (!messageId) {
      console.log('⏭️ No message_id in payload, trying to match by phone')
      
      // If no message ID, try to update the most recent message to this phone
      if (recipientPhone) {
        try {
          const result = await pool.query(`
            UPDATE sent_messages 
            SET 
              status = $1,
              error_message = $2,
              delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END,
              failed_at = CASE WHEN $1 = 'failed' THEN NOW() ELSE failed_at END
            WHERE recipient_phone LIKE '%' || $3
            AND sent_at > NOW() - INTERVAL '1 hour'
            AND (external_message_id IS NULL OR external_message_id = '')
          `, [
            status === 'delivered' ? 'delivered' : status === 'failed' ? 'failed' : 'sent',
            errorMessage,
            recipientPhone.slice(-9)  // Match last 9 digits
          ])
          console.log(`✅ Updated ${result.rowCount} message(s) for phone ${recipientPhone}: ${status}`)
        } catch (err) {
          console.log('Could not update by phone:', err)
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Status update processed' 
      })
    }

    // Update sent message status by message_id
    try {
      const result = await pool.query(`
        UPDATE sent_messages 
        SET 
          status = $1,
          error_message = $2,
          delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END,
          failed_at = CASE WHEN $1 = 'failed' THEN NOW() ELSE failed_at END
        WHERE external_message_id = $3
      `, [
        status === 'delivered' ? 'delivered' : status === 'failed' ? 'failed' : 'sent',
        errorMessage,
        messageId
      ])
      
      if (result.rowCount && result.rowCount > 0) {
        console.log(`✅ Updated status for message ${messageId}: ${status}`)
      } else {
        console.log(`⚠️ Message ${messageId} not found in database`)
      }
    } catch (updateErr) {
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
