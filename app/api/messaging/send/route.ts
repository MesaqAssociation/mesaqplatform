import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendWhatsAppMessage, formatPhoneNumber } from '@/lib/picky-assist'

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
  
  if (userRows.length === 0 || !['admin', 'board', 'Manager'].includes(userRows[0].role)) {
    return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { memberIds, message } = body

    if (!memberIds || memberIds.length === 0 || !message) {
      return NextResponse.json({ error: 'Member IDs and message are required' }, { status: 400 })
    }

    // Check if Picky Assist API is configured
    if (!process.env.PICKY_ASSIST_API_KEY || !process.env.PICKY_ASSIST_PROJECT_ID) {
      return NextResponse.json({ 
        error: 'Picky Assist API not configured',
        message: 'PICKY_ASSIST_API_KEY and PICKY_ASSIST_PROJECT_ID must be set'
      }, { status: 400 })
    }

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
            // Replace variables in message
            let personalizedMessage = message
              .replace(/\{\{name\}\}/g, member.name)
              .replace(/\{\{phone\}\}/g, member.phone || '')
              .replace(/\{\{email\}\}/g, member.email || '')

            const phone = formatPhoneNumber(member.phone)
            
            // Send status update
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                progress, 
                status: `Sending to ${member.name}...` 
              })}\n\n`)
            )

            // Send WhatsApp message
            const success = await sendWhatsAppMessage({
              to: phone,
              body: personalizedMessage
            })

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
            failed
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

