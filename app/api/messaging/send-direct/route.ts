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
 * Send a direct WhatsApp message (session message, not template)
 * Only works within 24 hours of the last incoming message from the recipient
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
    const { memberId, message } = await req.json()

    if (!memberId || !message?.trim()) {
      return NextResponse.json({ error: 'Member ID and message required' }, { status: 400 })
    }

    // Get member info
    const { rows: memberRows } = await pool.query(
      'SELECT id, name, phone FROM users WHERE id = $1',
      [memberId]
    )

    if (memberRows.length === 0 || !memberRows[0].phone) {
      return NextResponse.json({ error: 'Member not found or no phone number' }, { status: 404 })
    }

    const member = memberRows[0]
    const phone = formatPhoneNumber(member.phone)

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
    let sentMessage = message.trim()

    if (canSendFreeText) {
      // Send session message (free text)
      const payload = {
        token: apiKey,
        application: parseInt(applicationId),
        data: [{
          number: phone,
          message: sentMessage
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

      const payload = {
        token: apiKey,
        application: parseInt(applicationId),
        template_id: templateId,
        data: [{
          number: phone,
          template_message: [member.name, sentMessage],
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

    // Store sent message
    await storeSentMessage(pool, {
      messageType: 'admin_message',
      templateId: canSendFreeText ? undefined : process.env.PICKY_ASSIST_ADMIN_MESSAGE_TEMPLATE_ID,
      messageContent: sentMessage.substring(0, 500),
      recipientPhone: phone,
      recipientName: member.name,
      recipientMemberId: member.id,
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

