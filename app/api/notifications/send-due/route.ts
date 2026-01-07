import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { sendBulkAdminMessages, AdminMessageData } from '@/lib/picky-assist'

export const runtime = 'nodejs'

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

    // Check if we're in test mode
    const isTestMode = process.env.PICKY_ASSIST_TEST_MODE === 'true'
    const testNumber = process.env.WHATSAPP_TEST_NUMBER

    let totalSent = 0
    const results: Array<{ id: string, title: string, sent: number, failed: number }> = []

    for (const notification of dueNotifications) {
      let members: Array<{ id: string, name: string, phone: string }> = []
      
      // Get recipients based on recipient_type
      if (notification.recipient_type === 'specific' && notification.recipient_ids && notification.recipient_ids.length > 0) {
        // Get specific members
        const { rows } = await pool.query(`
          SELECT id, name, phone FROM users 
          WHERE id = ANY($1) AND phone IS NOT NULL AND phone != ''
        `, [notification.recipient_ids])
        members = rows
      } else {
        // Get all members (default: everyone)
        const { rows } = await pool.query(`
          SELECT id, name, phone FROM users WHERE phone IS NOT NULL AND phone != ''
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

      // Prepare admin messages for recipients
      // Note: The template format is:
      // "Salam {{1}},
      // 
      // {{2}}
      // 
      // Kind Regards - Mesaq"
      const adminMessages: AdminMessageData[] = members.map(member => ({
        memberName: member.name,
        message: `📢 ${notification.title}\n\n${notification.message}`,
        phone: member.phone
      }))

      const result = await sendBulkAdminMessages(
        adminMessages,
        isTestMode,
        testNumber
      )

      // Update notification status
      await pool.query(`
        UPDATE scheduled_notifications 
        SET 
          status = 'sent',
          sent_at = NOW(),
          recipients_count = $1
        WHERE id = $2
      `, [result.sent, notification.id])

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
      testMode: isTestMode,
      results
    })
  } catch (err: any) {
    console.error('Send due notifications error:', err)
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
  }
}
