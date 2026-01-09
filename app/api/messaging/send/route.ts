import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendBulkSMS, formatPhoneNumber, buildAdminMessage, SMSMessage } from '@/lib/mobile-message'

export const runtime = 'nodejs'

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
  const { rows: userRows } = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  )
  
  const userRole = (userRows[0]?.role || '').toLowerCase()
  if (userRows.length === 0 || !['admin', 'board', 'manager'].includes(userRole)) {
    return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { memberIds, message } = body

    if (!memberIds || memberIds.length === 0 || !message) {
      return NextResponse.json({ error: 'Member IDs and message are required' }, { status: 400 })
    }

    // Check if Mobile Message is configured
    if (!process.env.MOBILE_MESSAGE_USERNAME || !process.env.MOBILE_MESSAGE_PASSWORD) {
      return NextResponse.json({ 
        error: 'Mobile Message not configured',
        message: 'MOBILE_MESSAGE_USERNAME and MOBILE_MESSAGE_PASSWORD must be set'
      }, { status: 400 })
    }

    // Get member details
    const placeholders = memberIds.map((_: any, i: number) => `$${i + 1}`).join(',')
    const { rows: members } = await pool.query(`
      SELECT id, name, phone, email
      FROM users
      WHERE id IN (${placeholders})
    `, memberIds)

    console.log(`📤 Sending SMS to ${members.length} members in bulk...`)

    // Prepare SMS messages for all members
    const smsMessages: SMSMessage[] = members
      .filter((member: any) => member.phone)
      .map((member: any) => ({
        to: member.phone,
        message: buildAdminMessage(member.name, message.trim())
      }))

    if (smsMessages.length === 0) {
      return NextResponse.json({ 
        error: 'No members with valid phone numbers found' 
      }, { status: 400 })
    }

    // Send all messages in bulk
    const result = await sendBulkSMS(smsMessages)

    console.log(`✅ Bulk send complete: ${result.sent} sent, ${result.failed} failed`)

    return NextResponse.json({ 
      success: result.sent > 0,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped
    })
  } catch (err: any) {
    console.error('Send messages error:', err)
    return NextResponse.json({ 
      error: 'Failed to send messages',
      details: err.message 
    }, { status: 500 })
  }
}
