import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendWhatsAppMessage, formatPhoneNumber } from '@/lib/picky-assist'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Helper function to format time in 12-hour format
function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

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

      // Send WhatsApp notifications to group members
      try {
        const { rows: groupMembers } = await pool.query(`
          SELECT id, name, phone 
          FROM users 
          WHERE group_name = $1 AND phone IS NOT NULL
        `, [organizing_group])

        if (groupMembers.length > 0) {
          const eventDate = new Date(event_date)
          const formattedDate = eventDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          const formattedTime = start_time ? formatTime(start_time) : ''
          
          const message = `🎉 *Event Organization Assignment*\n\nYour group (*${organizing_group}*) has been assigned to organize the upcoming event!\n\n📅 *Event:* ${title}\n📆 *Date:* ${formattedDate}\n🕐 *Time:* ${formattedTime}\n📍 *Location:* ${address || 'TBD'}\n\n${description ? `📝 *Details:*\n${description}\n\n` : ''}Please coordinate with your group members to prepare for this event. Thank you for your service to the community! 🙏`

          // Send to each member in the group using the WhatsApp helper (respects test mode)
          for (const member of groupMembers) {
            await sendWhatsAppMessage({
              to: formatPhoneNumber(member.phone),
              body: message
            })
          }
          
          console.log(`✅ Sent event organization notifications to ${groupMembers.length} members in ${organizing_group}`)
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

