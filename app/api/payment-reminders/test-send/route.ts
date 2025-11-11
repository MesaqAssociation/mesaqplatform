import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { 
  sendWhatsAppMessage, 
  formatPhoneNumber,
  generateFirstReminderMessage,
} from '@/lib/whatsapp'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * Test endpoint to send first reminders as if it's Day 7 of next month
 * Does NOT store any data in payment_reminders table
 * Resets on page refresh
 */
export async function POST(req: NextRequest) {
  // Verify user is authenticated
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
    // Check if WhatsApp is configured
    if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
      return NextResponse.json({ 
        error: 'WhatsApp not configured',
        message: 'WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN must be set'
      }, { status: 400 })
    }

    // Simulate Day 7 of next month
    const today = new Date()
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 7)
    const lastMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    
    console.log(`🧪 TEST MODE: Simulating Day 7 of ${nextMonth.toLocaleDateString()}`)
    console.log(`   Checking for unpaid fees from ${lastMonth.toLocaleDateString()}`)

    // Get monthly fee
    const { rows: feeRows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
    )
    const monthlyFee = parseFloat(feeRows[0]?.value || '50.00')

    // Get all members with phone numbers
    const { rows: members } = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.phone,
        u.email
      FROM users u
      WHERE u.phone IS NOT NULL AND u.phone != ''
    `)

    let messagesSent = 0
    let memberResults: any[] = []

    for (const member of members) {
      // Check if member has paid for last month
      const { rows: paymentRows } = await pool.query(`
        SELECT SUM(amount) as total_paid
        FROM membership_payments
        WHERE user_id = $1
          AND payment_month = $2
          AND status = 'paid'
      `, [member.id, lastMonth.toISOString().split('T')[0]])

      const totalPaid = parseFloat(paymentRows[0]?.total_paid || '0')
      const hasPaid = totalPaid >= monthlyFee

      if (!hasPaid) {
        // Send first reminder
        const monthName = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        const message = generateFirstReminderMessage(member.name, monthlyFee, monthName)
        const phone = formatPhoneNumber(member.phone)

        const sent = await sendWhatsAppMessage({ to: phone, body: message })

        if (sent) {
          messagesSent++
          memberResults.push({
            name: member.name,
            phone: member.phone,
            amount: monthlyFee,
            month: monthName,
            sent: true
          })
          console.log(`✅ TEST: Sent reminder to ${member.name}`)
        } else {
          memberResults.push({
            name: member.name,
            phone: member.phone,
            amount: monthlyFee,
            month: monthName,
            sent: false,
            error: 'Failed to send'
          })
          console.log(`❌ TEST: Failed to send to ${member.name}`)
        }
      } else {
        memberResults.push({
          name: member.name,
          phone: member.phone,
          amount: monthlyFee,
          month: monthName,
          sent: false,
          skipped: true,
          reason: 'Already paid'
        })
      }
    }

    console.log(`🧪 TEST COMPLETE: ${messagesSent} messages sent (no data stored)`)

    return NextResponse.json({
      success: true,
      testMode: true,
      simulatedDate: nextMonth.toISOString().split('T')[0],
      simulatedDay: 7,
      checkingMonth: lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      totalMembers: members.length,
      messagesSent,
      results: memberResults,
      note: 'This was a test - no data was stored in the database'
    })
  } catch (err: any) {
    console.error('Test send error:', err)
    return NextResponse.json({ 
      error: 'Failed to send test messages',
      details: err.message 
    }, { status: 500 })
  }
}

