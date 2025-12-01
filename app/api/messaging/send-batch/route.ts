import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendWhatsAppMessage, formatPhoneNumber } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes max

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let decoded: any
  try {
    decoded = jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins/board can send messages
  const userId = decoded.userId || decoded.sub
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token - no user ID' }, { status: 401 })
  }
  
  const { rows: userRows } = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  )
  
  if (userRows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 403 })
  }
  
  const userRole = (userRows[0].role || '').toLowerCase()
  if (!['admin', 'board', 'manager'].includes(userRole)) {
    return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { memberIds, message } = body

    if (!memberIds || memberIds.length === 0 || !message) {
      return NextResponse.json({ error: 'Member IDs and message are required' }, { status: 400 })
    }

    // Check if Wasender API is configured
    if (!process.env.WASENDER_API_KEY) {
      return NextResponse.json({ 
        error: 'Wasender API not configured',
        message: 'WASENDER_API_KEY must be set'
      }, { status: 400 })
    }

    // Get member details
    const placeholders = memberIds.map((_: any, i: number) => `$${i + 1}`).join(',')
    const { rows: members } = await pool.query(`
      SELECT id, name, phone, email
      FROM users
      WHERE id IN (${placeholders})
    `, memberIds)

    console.log(`📤 Queuing ${members.length} messages with 5-second delays...`)

    // Start sending in background (function will continue after response)
    const sendMessages = async () => {
      let sent = 0
      let failed = 0

      for (let i = 0; i < members.length; i++) {
        const member = members[i]
        
        try {
          // Replace variables in message
          let personalizedMessage = message
            .replace(/\{\{name\}\}/g, member.name)
            .replace(/\{\{phone\}\}/g, member.phone || '')
            .replace(/\{\{email\}\}/g, member.email || '')

          const phone = formatPhoneNumber(member.phone)
          
          // Send WhatsApp message
          const success = await sendWhatsAppMessage({
            to: phone,
            body: personalizedMessage
          })

          if (success) {
            sent++
            console.log(`✅ (${i + 1}/${members.length}) Sent to ${member.name}`)
          } else {
            failed++
            console.log(`❌ (${i + 1}/${members.length}) Failed to send to ${member.name}`)
          }
        } catch (err) {
          failed++
          console.error(`❌ (${i + 1}/${members.length}) Error sending to ${member.name}:`, err)
        }

        // Wait 5 seconds before next message (except for the last one)
        if (i < members.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }
      
      console.log(`✅ Batch complete: ${sent} sent, ${failed} failed`)
    }

    // Start sending (don't await - let it run in background)
    sendMessages()

    // Return immediately to user
    return NextResponse.json({ 
      success: true,
      queued: members.length,
      message: `Sending ${members.length} messages with 5-second intervals. You can close this page.`
    })
  } catch (err: any) {
    console.error('Send batch error:', err)
    return NextResponse.json({ 
      error: 'Failed to queue messages',
      details: err.message 
    }, { status: 500 })
  }
}

