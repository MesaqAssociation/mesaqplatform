import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendBulkSMS, formatPhoneNumber, buildEventNotificationMessage, hasEnoughCredits, hasEnoughCreditsSimple, SMSMessage } from '@/lib/mobile-message'
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
      organizing_group,
      notify_group = true // Default to true for backwards compatibility
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

      // Only send SMS notifications if notify_group is true
      if (notify_group) {
        try {
          const { rows: groupMembers } = await pool.query(`
            SELECT id, name, phone 
            FROM users 
            WHERE group_name = $1 AND phone IS NOT NULL
          `, [organizing_group])

          const membersWithPhone = groupMembers.filter((m: any) => m.phone)

          // Check credit balance before sending (estimate 2 credits per event notification)
          if (membersWithPhone.length > 0 && process.env.MOBILE_MESSAGE_USERNAME) {
            const creditCheck = await hasEnoughCreditsSimple(membersWithPhone.length * 2)
            
            if (!creditCheck.hasEnough) {
              return NextResponse.json({ 
                error: `Not enough credits to notify group. Need ${creditCheck.requiredCredits} credits, have ${creditCheck.currentCredits}. Please top up or uncheck 'Notify Group Members'.`,
                event: result.rows[0]
              }, { status: 400 })
            }
          }

          if (membersWithPhone.length > 0) {
            // Format the event date for display with time
            const eventDate = new Date(event_date)
            const formattedDateOnly = eventDate.toLocaleDateString('en-AU', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })
            
            // Format times to 12-hour format
            const formatTo12Hour = (time24: string) => {
              const [h, m] = time24.split(':').map(Number)
              const period = h >= 12 ? 'PM' : 'AM'
              const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
              return `${hour12}:${m.toString().padStart(2, '0')}${period}`
            }
            
            const startTime12 = formatTo12Hour(start_time)
            const endTime12 = formatTo12Hour(end_time)
            const formattedDate = `${formattedDateOnly} ${startTime12} - ${endTime12}`

            // Get all member names for the "other members" field
            const allMemberNames = membersWithPhone.map((m: any) => m.name)

            // Prepare SMS messages for each member
            const smsMessages: SMSMessage[] = membersWithPhone.map((member: any) => {
              const otherMembers = allMemberNames
                .filter((name: string) => name !== member.name)
                .join(', ') || 'None'

              return {
                to: member.phone,
                message: buildEventNotificationMessage(
                  member.name,
                  title,
                  formattedDate,
                  organizing_group,
                  otherMembers
                )
              }
            })

            const smsResult = await sendBulkSMS(smsMessages)

            console.log(`✅ Event notifications: ${smsResult.sent} sent, ${smsResult.failed} failed, ${smsResult.skipped} skipped`)

            // Store sent messages in database with external message IDs
            const batchId = generateBatchId()
            const sentMessageData: SentMessageData[] = membersWithPhone.map((m: any) => {
              const phone = formatPhoneNumber(m.phone)
              const otherMembers = allMemberNames.filter((name: string) => name !== m.name).join(', ') || 'None'
              // Find the matching result by phone number
              const apiResult = smsResult.results.find(r => r.to === phone)
              
              return {
                messageType: 'event_notification' as const,
                templateId: undefined,
                messageContent: buildEventNotificationMessage(
                  m.name,
                  title,
                  formattedDate,
                  organizing_group,
                  otherMembers
                ),
                recipientPhone: phone,
                recipientName: m.name,
                recipientMemberId: m.id,
                status: apiResult?.status === 'sent' ? 'sent' : apiResult?.status === 'failed' ? 'failed' : 'sent',
                externalMessageId: apiResult?.messageId || undefined,
                errorMessage: apiResult?.error || undefined,
                batchId
              }
            })

            await storeSentMessagesBatch(pool, sentMessageData, batchId)
          }
        } catch (smsErr) {
          console.error('Failed to send SMS notifications:', smsErr)
          // Don't fail the event creation if notifications fail
        }
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
