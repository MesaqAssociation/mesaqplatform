import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * Picky Assist Delivery Status Webhook
 * 
 * URL to configure in Picky Assist: https://www.mesaq.com.au/api/messaging/delivery-status
 * 
 * Expected payload format from Picky Assist:
 * {
 *   "number": "61426967982",
 *   "unique-id": "751403635",       // The message ID we stored
 *   "status": "delivered" | "read" | "failed",
 *   "timestamp": "2024-01-07T12:00:00Z",
 *   "error": "Error message if failed"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    console.log('📬 Delivery status webhook received:', JSON.stringify(body).substring(0, 500))

    // Extract status info from Picky Assist payload
    // Picky Assist may use different field names, so check various possibilities
    const uniqueId = body['unique-id'] || body.unique_id || body.messageId || body.message_id
    const phoneNumber = body.number || body.phone
    const status = body.status?.toLowerCase()
    const errorMessage = body.error || body.error_message || body.reason

    if (!uniqueId && !phoneNumber) {
      console.log('⚠️ No identifier in delivery status webhook')
      return NextResponse.json({ success: true, message: 'No identifier provided' })
    }

    // Map Picky Assist status to our status
    let mappedStatus: 'delivered' | 'read' | 'failed' | null = null
    
    if (status === 'delivered' || status === 'sent' || status === 'server') {
      mappedStatus = 'delivered'
    } else if (status === 'read' || status === 'seen') {
      mappedStatus = 'read'
    } else if (status === 'failed' || status === 'undelivered' || status === 'error') {
      mappedStatus = 'failed'
    }

    if (!mappedStatus) {
      console.log(`⏭️ Unknown status: ${status}`)
      return NextResponse.json({ success: true, message: 'Status not processed' })
    }

    // Update by picky_assist_id first
    if (uniqueId) {
      const timestampColumn = mappedStatus === 'delivered' ? 'delivered_at' 
                            : mappedStatus === 'read' ? 'read_at' 
                            : 'failed_at'
      
      const { rowCount } = await pool.query(`
        UPDATE sent_messages 
        SET 
          status = $1,
          ${timestampColumn} = NOW(),
          error_message = COALESCE($2, error_message)
        WHERE picky_assist_id = $3
      `, [mappedStatus, errorMessage || null, uniqueId])

      if (rowCount && rowCount > 0) {
        console.log(`✅ Updated message ${uniqueId} status to ${mappedStatus}`)
        return NextResponse.json({ success: true, updated: rowCount })
      }
    }

    // Fallback: Update most recent message to this phone number
    if (phoneNumber) {
      const formattedPhone = phoneNumber.replace(/\D/g, '')
      const timestampColumn = mappedStatus === 'delivered' ? 'delivered_at' 
                            : mappedStatus === 'read' ? 'read_at' 
                            : 'failed_at'
      
      const { rowCount } = await pool.query(`
        UPDATE sent_messages 
        SET 
          status = $1,
          ${timestampColumn} = NOW(),
          error_message = COALESCE($2, error_message)
        WHERE id = (
          SELECT id FROM sent_messages 
          WHERE recipient_phone LIKE '%' || $3 || '%'
            AND status = 'sent'
          ORDER BY created_at DESC 
          LIMIT 1
        )
      `, [mappedStatus, errorMessage || null, formattedPhone.slice(-9)])

      if (rowCount && rowCount > 0) {
        console.log(`✅ Updated message to ${phoneNumber} status to ${mappedStatus}`)
        return NextResponse.json({ success: true, updated: rowCount })
      }
    }

    console.log(`⚠️ No matching message found for status update`)
    return NextResponse.json({ success: true, message: 'No matching message found' })
  } catch (err: any) {
    console.error('❌ Delivery status webhook error:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 })
  }
}

// Handle GET for webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge') || searchParams.get('hub.challenge')
  
  if (challenge) {
    return new Response(challenge, { status: 200 })
  }
  
  return NextResponse.json({ 
    status: 'Delivery status webhook active',
    endpoint: '/api/messaging/delivery-status'
  })
}

