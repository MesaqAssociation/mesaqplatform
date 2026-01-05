import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendBulkAdminMessages, formatPhoneNumber, AdminMessageData } from '@/lib/picky-assist'

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

    // Check if Picky Assist API is configured
    if (!process.env.PICKY_ASSIST_API_KEY) {
      return NextResponse.json({ 
        error: 'Picky Assist API not configured',
        message: 'PICKY_ASSIST_API_KEY must be set'
      }, { status: 400 })
    }

    // Check if admin message template is configured
    if (!process.env.PICKY_ASSIST_ADMIN_MESSAGE_TEMPLATE_ID) {
      return NextResponse.json({ 
        error: 'Admin message template not configured',
        message: 'PICKY_ASSIST_ADMIN_MESSAGE_TEMPLATE_ID must be set'
      }, { status: 400 })
    }

    // Get member details
    const placeholders = memberIds.map((_: any, i: number) => `$${i + 1}`).join(',')
    const { rows: members } = await pool.query(`
      SELECT id, name, phone, email
      FROM users
      WHERE id IN (${placeholders})
    `, memberIds)

    console.log(`📤 Sending admin messages to ${members.length} members...`)

    // Prepare admin message data for each member
    // Note: The template has the format:
    // "Salam {{1}},
    // 
    // {{2}}
    // 
    // Thank you - Mesaq"
    const adminMessages: AdminMessageData[] = members
      .filter(member => member.phone)
      .map(member => ({
        memberName: member.name,
        message: message.trim(),  // The admin's message content
        phone: member.phone
      }))

    if (adminMessages.length === 0) {
      return NextResponse.json({ 
        error: 'No members with valid phone numbers found' 
      }, { status: 400 })
          }

    // Check if we're in test mode
    const isTestMode = process.env.PICKY_ASSIST_TEST_MODE === 'true'
    const testNumber = process.env.WHATSAPP_TEST_NUMBER

    const result = await sendBulkAdminMessages(
      adminMessages,
      isTestMode,
      testNumber
    )

    console.log(`✅ Admin messages: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`)

    return NextResponse.json({ 
      success: result.success,
      queued: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      message: isTestMode 
        ? `Test mode: ${result.sent} messages sent to test number`
        : `${result.sent} messages sent successfully`
    })
  } catch (err: any) {
    console.error('Send batch error:', err)
    return NextResponse.json({ 
      error: 'Failed to send messages',
      details: err.message 
    }, { status: 500 })
  }
}
