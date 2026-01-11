import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { sendBulkSMS, formatPhoneNumber, SMSMessage } from '@/lib/mobile-message'
import { storeSentMessagesBatch, generateBatchId, SentMessageData } from '@/lib/store-sent-message'

export const runtime = 'nodejs'

/**
 * Replace variables in message with member data
 * Variables: {{name}}, {{phone}}, {{group}}
 */
function replaceVariables(message: string, member: any): string {
  return message
    .replace(/\{\{name\}\}/gi, member.name || 'N/A')
    .replace(/\{\{phone\}\}/gi, member.phone || 'N/A')
    .replace(/\{\{group\}\}/gi, member.group_name || 'N/A')
}

/**
 * Build scheduled message content with variable replacement
 * Note: Title is NOT included - it's only for admin reference
 */
function buildScheduledMessage(memberName: string, messageBody: string, member: any): string {
  // Replace variables in the message body
  const processedMessage = replaceVariables(messageBody, member)
  return processedMessage
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// This endpoint can be called by a cron job to send due notifications
export async function POST(req: NextRequest) {
  // Verify cron secret if provided (optional security)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]

    // Get all pending notifications for today or earlier
    const { rows: dueNotifications } = await pool.query(`
      SELECT id, title, message, recipient_type, recipient_ids 
      FROM scheduled_notifications 
      WHERE status = 'pending' AND scheduled_date <= $1
    `, [today])

    if (dueNotifications.length === 0) {
      return NextResponse.json({ message: 'No notifications to send', sent: 0 })
    }

    let totalSent = 0
    const results: Array<{ id: string, title: string, sent: number, failed: number }> = []

    for (const notification of dueNotifications) {
      let members: Array<{ id: string, name: string, phone: string, group_name: string | null }> = []
      
      // Get recipients based on recipient_type (include group_name for variable replacement)
      if (notification.recipient_type === 'specific' && notification.recipient_ids && notification.recipient_ids.length > 0) {
        // Get specific members
        const { rows } = await pool.query(`
          SELECT id, name, phone, group_name FROM users 
          WHERE id = ANY($1) AND phone IS NOT NULL AND phone != ''
        `, [notification.recipient_ids])
        members = rows
      } else {
        // Get all members (default: everyone)
        const { rows } = await pool.query(`
          SELECT id, name, phone, group_name FROM users WHERE phone IS NOT NULL AND phone != ''
        `)
        members = rows
      }

      if (members.length === 0) {
        console.log(`⚠️ Notification "${notification.title}": No recipients with phone numbers`)
        await pool.query(`
          UPDATE scheduled_notifications 
          SET status = 'sent', sent_at = NOW(), recipients_count = 0
          WHERE id = $1
        `, [notification.id])
        results.push({ id: notification.id, title: notification.title, sent: 0, failed: 0 })
        continue
      }

      // Prepare SMS messages for recipients with variable replacement
      // Note: Title is NOT sent - it's only for admin reference
      const smsMessages: SMSMessage[] = members.map(member => ({
        to: member.phone,
        message: buildScheduledMessage(member.name, notification.message, member)
      }))

      const result = await sendBulkSMS(smsMessages)

      // Update notification status
      await pool.query(`
        UPDATE scheduled_notifications 
        SET 
          status = 'sent',
          sent_at = NOW(),
          recipients_count = $1
        WHERE id = $2
      `, [result.sent, notification.id])

      // Store sent messages in database with external message IDs
      const batchId = generateBatchId()
      const sentMessageData: SentMessageData[] = members.map((member: any) => {
        const phone = formatPhoneNumber(member.phone)
        // Find the matching result by phone number
        const apiResult = result.results.find(r => r.to === phone)
        
        return {
          messageType: 'scheduled' as const,
          templateId: undefined,
          messageContent: buildScheduledMessage(member.name, notification.message, member),
          recipientPhone: phone,
          recipientName: member.name,
          recipientMemberId: member.id,
          status: apiResult?.status === 'sent' ? 'sent' : apiResult?.status === 'failed' ? 'failed' : 'sent',
          externalMessageId: apiResult?.messageId || undefined,
          errorMessage: apiResult?.error || undefined,
          batchId
        }
      })

      await storeSentMessagesBatch(pool, sentMessageData, batchId)

      totalSent += result.sent
      results.push({ 
        id: notification.id, 
        title: notification.title, 
        sent: result.sent, 
        failed: result.failed 
      })

      console.log(`✅ Notification "${notification.title}": ${result.sent} sent, ${result.failed} failed`)
    }

    return NextResponse.json({ 
      message: 'Notifications sent',
      total_sent: totalSent,
      notifications_processed: dueNotifications.length,
      results
    })
  } catch (err: any) {
    console.error('Send due notifications error:', err)
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
  }
}
