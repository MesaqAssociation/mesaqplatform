import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

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
      SELECT id, title, message 
      FROM scheduled_notifications 
      WHERE status = 'pending' AND scheduled_date <= $1
    `, [today])

    if (dueNotifications.length === 0) {
      return NextResponse.json({ message: 'No notifications to send', sent: 0 })
    }

    // Get all members with valid phone numbers
    const { rows: members } = await pool.query(`
      SELECT id, name, phone FROM users WHERE phone IS NOT NULL AND phone != ''
    `)

    let totalSent = 0
    const results: Array<{ id: string, title: string, sent: number, failed: number }> = []

    for (const notification of dueNotifications) {
      let sent = 0
      let failed = 0

      // Send to all members
      for (const member of members) {
        try {
          const success = await sendWhatsAppMessage({
            to: member.phone,
            body: `📢 ${notification.title}\n\n${notification.message}`
          })
          
          if (success) {
            sent++
          } else {
            failed++
          }
        } catch (err) {
          console.error(`Failed to send to ${member.phone}:`, err)
          failed++
        }
      }

      // Update notification status
      await pool.query(`
        UPDATE scheduled_notifications 
        SET 
          status = 'sent',
          sent_at = NOW(),
          recipients_count = $1
        WHERE id = $2
      `, [sent, notification.id])

      totalSent += sent
      results.push({ id: notification.id, title: notification.title, sent, failed })
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
