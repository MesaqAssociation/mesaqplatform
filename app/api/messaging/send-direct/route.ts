import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendSMS, formatPhoneNumber } from '@/lib/mobile-message'
import { storeSentMessage } from '@/lib/store-sent-message'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * POST /api/messaging/send-direct
 * Send a direct SMS message to a member OR any phone number
 * No templates needed - just sends the message directly
 */
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

  const userId = decoded.userId || decoded.sub
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  try {
    const { memberId, phoneNumber, contactName, message } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    if (!memberId && !phoneNumber) {
      return NextResponse.json({ error: 'Member ID or phone number required' }, { status: 400 })
    }

    let phone: string
    let recipientName: string
    let recipientMemberId: string | null = null

    if (memberId) {
      // Get member info
      const { rows: memberRows } = await pool.query(
        'SELECT id, name, phone FROM users WHERE id = $1',
        [memberId]
      )

      if (memberRows.length === 0 || !memberRows[0].phone) {
        return NextResponse.json({ error: 'Member not found or no phone number' }, { status: 404 })
      }

      phone = formatPhoneNumber(memberRows[0].phone)
      recipientName = memberRows[0].name
      recipientMemberId = memberRows[0].id
    } else {
      // Use provided phone number directly
      phone = formatPhoneNumber(phoneNumber)
      recipientName = contactName || phoneNumber
      
      // Try to find matching member by phone
      const phoneKey = phone.replace(/\D/g, '').slice(-9)
      const { rows: matchedMember } = await pool.query(`
        SELECT id, name FROM users 
        WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = $1
        LIMIT 1
      `, [phoneKey])
      
      if (matchedMember.length > 0) {
        recipientMemberId = matchedMember[0].id
        recipientName = matchedMember[0].name
      }
    }

    if (!process.env.MOBILE_MESSAGE_USERNAME || !process.env.MOBILE_MESSAGE_PASSWORD) {
      return NextResponse.json({ error: 'Mobile Message not configured' }, { status: 400 })
    }

    // Send SMS directly - just the message, no template wrapper
    const userMessage = message.trim()
    const result = await sendSMS(phone, userMessage)

    console.log(`📤 Sent SMS to ${phone}:`, result.success ? 'OK' : 'FAILED')

    // Store sent message with external message ID
    await storeSentMessage(pool, {
      messageType: 'admin_message',
      templateId: undefined,
      messageContent: userMessage,
      recipientPhone: phone,
      recipientName: recipientName,
      recipientMemberId: recipientMemberId || undefined,
      status: result.success ? 'sent' : 'failed',
      externalMessageId: result.messageId || undefined,
      errorMessage: result.error || undefined,
      sentBy: userId
    })

    if (result.success) {
      return NextResponse.json({ success: true, freeText: true })
    } else {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
  } catch (err: any) {
    console.error('Send direct message error:', err)
    return NextResponse.json({ 
      error: 'Failed to send message',
      details: err.message 
    }, { status: 500 })
  }
}
