import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendBulkEventNotifications, formatPhoneNumber, EventNotificationData } from '@/lib/picky-assist'
import { storeSentMessagesBatch, generateBatchId, SentMessageData } from '@/lib/store-sent-message'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function POST(req: NextRequest) {
  // Verify admin
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
    const body = await req.json()
    const { 
      title, 
      description,
      address,
      estimated_cost, 
      event_date, 
      start_time, 
      end_time, 
      event_type,
      agenda,
      organizing_group 
    } = body

    if (!title || !event_date || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Insert event
    const result = await pool.query(
      `INSERT INTO events (
        id, 
        title, 
        description,
        address,
        event_type, 
        event_date, 
        start_time, 
        end_time, 
        estimated_cost, 
        agenda,
        organizing_group
      ) VALUES (
        gen_random_uuid(), 
        $1, 
        $2, 
        $3,
        $4, 
        $5, 
        $6, 
        $7, 
        $8, 
        $9,
        $10
      ) RETURNING id, title, event_type, event_date`,
      [
        title, 
        description || null,
        address || null,
        event_type || 'Event', 
        event_date, 
        start_time, 
        end_time, 
        estimated_cost ? parseFloat(estimated_cost) : null, 
        JSON.stringify(agenda || []),
        organizing_group || null
      ]
    )

    const event = result.rows[0]
    
    // Update last organizing group in settings
    if (organizing_group) {
      await pool.query(`
        INSERT INTO system_settings (key, value)
        VALUES ('last_organizing_group', $1)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value
      `, [organizing_group])

      // Send WhatsApp notifications to group members using event template
      try {
        const { rows: groupMembers } = await pool.query(`
          SELECT id, name, phone 
          FROM users 
          WHERE group_name = $1 AND phone IS NOT NULL
        `, [organizing_group])

        if (groupMembers.length > 0) {
          // Format the event date for display
          const eventDate = new Date(event_date)
          const formattedDate = eventDate.toLocaleDateString('en-AU', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })

          // Get all member names for the "other members" field
          const allMemberNames = groupMembers.map(m => m.name)

          // Prepare event notification data for each member
          const eventNotifications: EventNotificationData[] = groupMembers
            .filter(member => member.phone)
            .map(member => {
              // Get other members (exclude current member)
              const otherMembers = allMemberNames
                .filter(name => name !== member.name)
                .join(', ')

              return {
                memberName: member.name,
                eventName: title,
                eventDate: formattedDate,
                groupName: organizing_group,
                otherGroupMembers: otherMembers || 'None',
                phone: member.phone
              }
            })

          if (eventNotifications.length > 0) {
            // Check if we're in test mode
            const isTestMode = process.env.PICKY_ASSIST_TEST_MODE === 'true'
            const testNumber = process.env.WHATSAPP_TEST_NUMBER

            const result = await sendBulkEventNotifications(
              eventNotifications,
              isTestMode,
              testNumber
            )

            console.log(`✅ Event notifications: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`)

            // Store sent messages in database with FULL template content
            const batchId = generateBatchId()
            const sentMessageData: SentMessageData[] = groupMembers
              .filter((m: any) => m.phone)
              .map((m: any) => {
                const otherMembers = allMemberNames.filter(name => name !== m.name).join(', ') || 'None'
                return {
                  messageType: 'event_notification' as const,
                  templateId: process.env.PICKY_ASSIST_EVENT_TEMPLATE_ID,
                  // Store FULL template message content
                  messageContent: `Salam ${m.name},\n\nYou have been assigned to: ${title} - ${formattedDate}\n\nYour group: ${organizing_group}\nOther members: ${otherMembers}\n\nThank you - Mesaq Association`,
                  recipientPhone: formatPhoneNumber(m.phone),
                  recipientName: m.name,
                  recipientMemberId: m.id,
                  status: result.success ? 'sent' : 'failed',
                  batchId
                }
              })

            await storeSentMessagesBatch(pool, sentMessageData, batchId)
          }
        }
      } catch (whatsappErr) {
        console.error('Failed to send WhatsApp notifications:', whatsappErr)
        // Don't fail the event creation if notifications fail
      }
    }
    
    return NextResponse.json({ event: result.rows[0] })
  } catch (err: any) {
    console.error('Create event error:', err)
    return NextResponse.json({ 
      error: err.message || 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}
