import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendBulkAdminMessages, AdminMessageData } from '@/lib/picky-assist'

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

    console.log(`📤 Sending messages to ${members.length} members in bulk...`)

    // Prepare admin message data for all members
    const adminMessages: AdminMessageData[] = members
      .filter(member => member.phone)
      .map(member => ({
        memberName: member.name,
        message: message.trim(),
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

    // Send all messages in bulk (single API call)
    const result = await sendBulkAdminMessages(
      adminMessages,
      isTestMode,
      testNumber
    )

    console.log(`✅ Bulk send complete: ${result.sent} sent, ${result.failed} failed`)

    return NextResponse.json({ 
      success: result.success,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      testMode: isTestMode
    })
  } catch (err: any) {
    console.error('Send messages error:', err)
    return NextResponse.json({ 
      error: 'Failed to send messages',
      details: err.message 
    }, { status: 500 })
  }
}
