import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendBulkSMS, formatPhoneNumber, hasEnoughCredits, SMSMessage } from '@/lib/mobile-message'
import { storeSentMessagesBatch, generateBatchId, SentMessageData } from '@/lib/store-sent-message'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes max

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * Replace variables in message with member data
 * Variables: {{name}}, {{phone}}, {{group}}
 */
function replaceVariables(message: string, member: any): string {
  return message
    .replace(/\{\{name\}\}/gi, member.name || 'N/A')
    .replace(/\{\{phone\}\}/gi, member.phone || 'N/A')
    .replace(/\{\{group\}\}/gi, member.group_name || 'N/A')
}

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

    // Check if Mobile Message is configured
    if (!process.env.MOBILE_MESSAGE_USERNAME || !process.env.MOBILE_MESSAGE_PASSWORD) {
      return NextResponse.json({ 
        error: 'Mobile Message not configured',
        message: 'MOBILE_MESSAGE_USERNAME and MOBILE_MESSAGE_PASSWORD must be set'
      }, { status: 400 })
    }

    // Get member details including group_name
    const placeholders = memberIds.map((_: any, i: number) => `$${i + 1}`).join(',')
    const { rows: members } = await pool.query(`
      SELECT id, name, phone, email, group_name
      FROM users
      WHERE id IN (${placeholders})
    `, memberIds)

    const membersWithPhone = members.filter((m: any) => m.phone)

    if (membersWithPhone.length === 0) {
      return NextResponse.json({ 
        error: 'No members with valid phone numbers found' 
      }, { status: 400 })
    }

    // Check credit balance (1 credit per message) - but don't fail if balance check fails
    try {
      const creditCheck = await hasEnoughCredits(membersWithPhone.length)
      if (!creditCheck.hasEnough && creditCheck.currentCredits > 0) {
        return NextResponse.json({ 
          error: `Not enough credits to send ${membersWithPhone.length} messages. Need ${creditCheck.requiredCredits} credits, have ${creditCheck.currentCredits}. Please top up.`
        }, { status: 400 })
      }
    } catch (creditErr) {
      console.log('Credit check failed, proceeding anyway:', creditErr)
      // Continue anyway if credit check fails
    }

    console.log(`📤 Sending SMS to ${membersWithPhone.length} members...`)

    // Prepare SMS messages - replace variables for each member
    const smsMessages: SMSMessage[] = membersWithPhone.map((member: any) => ({
      to: member.phone,
      message: replaceVariables(message.trim(), member)
    }))

    const result = await sendBulkSMS(smsMessages)

    console.log(`✅ SMS messages: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`)

    // Store sent messages in database
    const batchId = generateBatchId()
    const sentMessageData: SentMessageData[] = membersWithPhone.map((member: any) => ({
      messageType: 'admin_message' as const,
      templateId: undefined,
      messageContent: replaceVariables(message.trim(), member),
      recipientPhone: formatPhoneNumber(member.phone),
      recipientName: member.name,
      recipientMemberId: member.id,
      status: result.sent > 0 ? 'sent' : 'failed',
      sentBy: userId,
      batchId
    }))

    await storeSentMessagesBatch(pool, sentMessageData, batchId)

    return NextResponse.json({ 
      success: result.sent > 0,
      queued: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      message: `${result.sent} messages sent successfully`
    })
  } catch (err: any) {
    console.error('Send batch error:', err)
    return NextResponse.json({ 
      error: 'Failed to send messages',
      details: err.message 
    }, { status: 500 })
  }
}
