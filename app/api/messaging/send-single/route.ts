import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendSMS, formatPhoneNumber, buildAdminMessage } from '@/lib/mobile-message'
import { storeSentMessage } from '@/lib/store-sent-message'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * POST /api/messaging/send-single
 * Send a single SMS message to a member using admin message format
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

    if (!process.env.MOBILE_MESSAGE_USERNAME || !process.env.MOBILE_MESSAGE_PASSWORD) {
      return NextResponse.json({ error: 'Mobile Message not configured' }, { status: 400 })
    }

    // Build admin message with greeting and signature
    const fullMessage = buildAdminMessage(member.name, message.trim())
    const result = await sendSMS(phone, fullMessage)

    console.log(`📤 Sent SMS to ${phone}:`, result.success ? 'OK' : 'FAILED')

    // Store sent message
    await storeSentMessage(pool, {
      messageType: 'admin_message',
      templateId: undefined,
      messageContent: fullMessage,
      recipientPhone: phone,
      recipientName: member.name,
      recipientMemberId: member.id,
      status: result.success ? 'sent' : 'failed',
      sentBy: userId
    })

    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
  } catch (err: any) {
    console.error('Send single message error:', err)
    return NextResponse.json({ 
      error: 'Failed to send message',
      details: err.message 
    }, { status: 500 })
  }
}
