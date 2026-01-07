import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { formatPhoneNumber } from '@/lib/picky-assist'
import { storeSentMessage } from '@/lib/store-sent-message'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * POST /api/messaging/send-direct
 * Send a direct WhatsApp message to a member OR any phone number
 * - If within 24h of last incoming message: sends free text
 * - Otherwise: sends via admin message template
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

    // Check if within 24-hour window (last incoming message from this number)
    const phoneKey = phone.replace(/\D/g, '').slice(-9)
    const { rows: lastIncoming } = await pool.query(`
      SELECT created_at FROM incoming_messages 
      WHERE RIGHT(REGEXP_REPLACE(from_phone, '[^0-9]', '', 'g'), 9) = $1
      ORDER BY created_at DESC 
      LIMIT 1
    `, [phoneKey])

    const canSendFreeText = lastIncoming.length > 0 && 
      (Date.now() - new Date(lastIncoming[0].created_at).getTime()) <= 24 * 60 * 60 * 1000

    const apiKey = process.env.PICKY_ASSIST_API_KEY
    const applicationId = process.env.PICKY_ASSIST_APPLICATION_ID || '121'

    if (!apiKey) {
      return NextResponse.json({ error: 'Picky Assist not configured' }, { status: 400 })
    }

    let success = false
    const userMessage = message.trim()
    let fullMessageContent: string

    if (canSendFreeText) {
      // Send session message (free text)
      fullMessageContent = userMessage
      
      const payload = {
        token: apiKey,
        application: parseInt(applicationId),
        data: [{
          number: phone,
          message: userMessage
        }]
      }

      const response = await fetch('https://app.pickyassist.com/api/v2/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      success = response.ok
      console.log(`📤 Sent session message to ${phone}:`, success ? 'OK' : 'FAILED')
    } else {
      // Send via template (admin message template)
      const templateId = process.env.PICKY_ASSIST_ADMIN_MESSAGE_TEMPLATE_ID
      if (!templateId) {
        return NextResponse.json({ error: 'Admin message template not configured' }, { status: 400 })
      }

      // Store the FULL message including template wrapper
      fullMessageContent = `Salam ${recipientName},\n\n${userMessage}\n\nKind Regards - Mesaq Association`

      const payload = {
        token: apiKey,
        application: parseInt(applicationId),
        template_id: templateId,
        data: [{
          number: phone,
          template_message: [recipientName, userMessage],
          language: 'en'
        }]
      }

      const response = await fetch('https://app.pickyassist.com/api/v2/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      success = response.ok
      console.log(`📤 Sent template message to ${phone}:`, success ? 'OK' : 'FAILED')
    }

    // Store sent message with FULL content
    await storeSentMessage(pool, {
      messageType: 'admin_message',
      templateId: canSendFreeText ? undefined : process.env.PICKY_ASSIST_ADMIN_MESSAGE_TEMPLATE_ID,
      messageContent: fullMessageContent,
      recipientPhone: phone,
      recipientName: recipientName,
      recipientMemberId: recipientMemberId || undefined,
      status: success ? 'sent' : 'failed',
      sentBy: userId
    })

    if (success) {
      return NextResponse.json({ success: true, freeText: canSendFreeText })
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
