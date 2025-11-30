import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendWhatsAppMessage, formatPhoneNumber } from '@/lib/whatsapp'

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
  const userId = decoded.userId
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
    const { memberId, message } = body

    if (!memberId || !message) {
      return NextResponse.json({ error: 'Member ID and message are required' }, { status: 400 })
    }

    // Check if Wasender API is configured
    if (!process.env.WASENDER_API_KEY) {
      return NextResponse.json({ 
        error: 'Wasender API not configured',
        message: 'WASENDER_API_KEY must be set'
      }, { status: 400 })
    }

    // Get member details
    const { rows: members } = await pool.query(`
      SELECT id, name, phone, email
      FROM users
      WHERE id = $1
    `, [memberId])

    if (members.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const member = members[0]

    // Replace variables in message
    let personalizedMessage = message
      .replace(/\{\{name\}\}/g, member.name)
      .replace(/\{\{phone\}\}/g, member.phone || '')
      .replace(/\{\{email\}\}/g, member.email || '')

    const phone = formatPhoneNumber(member.phone)
    
    // Send WhatsApp message
    const success = await sendWhatsAppMessage({
      to: phone,
      body: personalizedMessage
    })

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
  } catch (err: any) {
    console.error('Send message error:', err)
    return NextResponse.json({ 
      error: 'Failed to send message',
      details: err.message 
    }, { status: 500 })
  }
}

