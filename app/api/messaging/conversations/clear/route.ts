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
 * DELETE /api/messaging/conversations/clear
 * Delete all conversations (incoming and sent messages)
 */
export async function DELETE(req: NextRequest) {
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

  // Only admins/board can clear conversations
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
    // Delete all incoming messages
    const { rowCount: incomingDeleted } = await pool.query('DELETE FROM incoming_messages')
    
    // Delete all sent messages
    const { rowCount: sentDeleted } = await pool.query('DELETE FROM sent_messages')

    console.log(`🗑️ Cleared ${incomingDeleted || 0} incoming and ${sentDeleted || 0} sent messages`)

    return NextResponse.json({ 
      success: true,
      deleted: {
        incoming: incomingDeleted || 0,
        sent: sentDeleted || 0
      },
      message: `Deleted ${(incomingDeleted || 0) + (sentDeleted || 0)} messages`
    })
  } catch (err: any) {
    console.error('Clear conversations error:', err)
    return NextResponse.json({ 
      error: 'Failed to clear conversations',
      details: err.message 
    }, { status: 500 })
  }
}

