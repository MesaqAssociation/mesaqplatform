import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * GET /api/messaging/sent
 * Fetch sent messages with pagination
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Messages per page (default: 30, max: 100)
 * - type: Filter by message type (optional)
 */
export async function GET(req: NextRequest) {
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
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')))
    const type = searchParams.get('type')
    const offset = (page - 1) * limit

    // Build query with optional type filter
    let whereClause = ''
    const params: any[] = [limit, offset]
    
    if (type) {
      whereClause = 'WHERE sm.message_type = $3'
      params.push(type)
    }

    // Get total count
    const countQuery = type 
      ? 'SELECT COUNT(*) FROM sent_messages WHERE message_type = $1'
      : 'SELECT COUNT(*) FROM sent_messages'
    const { rows: countRows } = await pool.query(countQuery, type ? [type] : [])
    const totalCount = parseInt(countRows[0].count)
    const totalPages = Math.ceil(totalCount / limit)

    // Get messages with recipient info
    const { rows: messages } = await pool.query(`
      SELECT 
        sm.id,
        sm.message_type,
        sm.template_id,
        sm.message_content,
        sm.recipient_phone,
        sm.recipient_name,
        sm.recipient_member_id,
        sm.status,
        sm.external_message_id,
        sm.error_message,
        sm.batch_id,
        sm.created_at,
        sm.sent_at,
        sm.delivered_at,
        sm.read_at,
        sm.failed_at,
        u.name as sender_name,
        r.name as member_name,
        r.member_id as member_code
      FROM sent_messages sm
      LEFT JOIN users u ON u.id = sm.sent_by
      LEFT JOIN users r ON r.id = sm.recipient_member_id
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $1 OFFSET $2
    `, params)

    return NextResponse.json({
      messages: messages.map(m => ({
        id: m.id,
        messageType: m.message_type,
        templateId: m.template_id,
        content: m.message_content,
        recipientPhone: m.recipient_phone,
        recipientName: m.recipient_name || m.member_name,
        recipientMemberId: m.recipient_member_id,
        memberCode: m.member_code,
        status: m.status,
        externalMessageId: m.external_message_id,
        errorMessage: m.error_message,
        batchId: m.batch_id,
        senderName: m.sender_name,
        createdAt: m.created_at,
        sentAt: m.sent_at,
        deliveredAt: m.delivered_at,
        readAt: m.read_at,
        failedAt: m.failed_at
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
  } catch (err: any) {
    console.error('Get sent messages error:', err)
    return NextResponse.json({ 
      error: 'Failed to fetch sent messages',
      details: err.message 
    }, { status: 500 })
  }
}

