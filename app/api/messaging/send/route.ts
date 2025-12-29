import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendAdminMessage, formatPhoneNumber } from '@/lib/picky-assist'

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

    // Check if we're in test mode
    const isTestMode = process.env.PICKY_ASSIST_TEST_MODE === 'true'
    const testNumber = process.env.WHATSAPP_TEST_NUMBER

    // Get member details
    const placeholders = memberIds.map((_: any, i: number) => `$${i + 1}`).join(',')
    const { rows: members } = await pool.query(`
      SELECT id, name, phone, email
      FROM users
      WHERE id IN (${placeholders})
    `, memberIds)

    // Create a readable stream for Server-Sent Events
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let sent = 0
        let failed = 0

        for (let i = 0; i < members.length; i++) {
          const member = members[i]
          const progress = Math.round(((i + 1) / members.length) * 100)

          try {
            // Send status update
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                progress, 
                status: `Sending to ${member.name}...`,
                testMode: isTestMode
              })}\n\n`)
            )

            // Send using admin message template
            // Template format: "Salam {{1}}, {{2}} Thank you - Mesaq"
            const success = await sendAdminMessage(
              {
                memberName: member.name,
                message: message.trim(),
                phone: member.phone
              },
              isTestMode ? testNumber : undefined
            )

            if (success) {
              sent++
            } else {
              failed++
            }

            // Small delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500))
          } catch (err) {
            console.error(`Failed to send to ${member.name}:`, err)
            failed++
          }
        }

        // Send completion
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            complete: true,
            progress: 100,
            status: 'Complete',
            sent,
            failed,
            testMode: isTestMode
          })}\n\n`)
        )

        controller.close()
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err: any) {
    console.error('Send messages error:', err)
    return NextResponse.json({ 
      error: 'Failed to send messages',
      details: err.message 
    }, { status: 500 })
  }
}
