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
 * TESTING ENDPOINT - Manual trigger for payment reminders
 * 
 * Allows testing the reminder system by simulating different dates
 * without waiting for actual cron schedule
 * 
 * Query params:
 * - date: YYYY-MM-DD format (default: today)
 * - stage: 1 (first), 2 (second), 3 (final) - which reminder to test
 * 
 * Examples:
 * /api/payment-reminders/test?date=2024-12-07&stage=1
 * /api/payment-reminders/test?date=2024-12-14&stage=2
 */
export async function GET(req: NextRequest) {
  // Check auth - only board members can test
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    const { rows: userRows } = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [decoded.sub]
    )

    if (!userRows[0] || userRows[0].role !== 'board') {
      return NextResponse.json({ error: 'Only board members can test reminders' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')
    const stageParam = searchParams.get('stage')

    // Parse test date
    const testDate = dateParam ? new Date(dateParam + 'T00:00:00') : new Date()
    const dayOfMonth = testDate.getDate()
    const stage = stageParam ? parseInt(stageParam) : null

    console.log(`🧪 TEST MODE: Simulating ${testDate.toISOString().split('T')[0]} (day ${dayOfMonth})`)

    // Get settings
    const { rows: settings } = await pool.query(
      "SELECT key, value FROM system_settings WHERE key IN ('monthly_membership_fee', 'late_payment_fines_enabled', 'late_payment_fine_amount')"
    )
    
    const monthlyFee = parseFloat(settings.find(s => s.key === 'monthly_membership_fee')?.value || '50.00')
    const finesEnabled = settings.find(s => s.key === 'late_payment_fines_enabled')?.value === 'true'
    const fineAmount = parseFloat(settings.find(s => s.key === 'late_payment_fine_amount')?.value || '10.00')

    // Calculate which months to check
    const currentMonth = new Date(testDate.getFullYear(), testDate.getMonth(), 1)
    const lastMonth = new Date(testDate.getFullYear(), testDate.getMonth() - 1, 1)
    const twoMonthsAgo = new Date(testDate.getFullYear(), testDate.getMonth() - 2, 1)

    console.log(`Current month: ${currentMonth.toISOString().split('T')[0]}`)
    console.log(`Last month: ${lastMonth.toISOString().split('T')[0]}`)
    console.log(`Two months ago: ${twoMonthsAgo.toISOString().split('T')[0]}`)

    // Get all members
    const { rows: members } = await pool.query(`
      SELECT 
        u.id,
        u.member_id,
        u.name,
        u.phone,
        u.email
      FROM users u
      WHERE u.phone IS NOT NULL AND u.phone != ''
      ORDER BY u.name
    `)

    const results = []

    for (const member of members) {
      // Check last month payment
      const { rows: lastMonthPayment } = await pool.query(`
        SELECT SUM(amount) as total_paid
        FROM membership_payments
        WHERE user_id = $1
          AND payment_month = $2
          AND status = 'paid'
      `, [member.id, lastMonth.toISOString().split('T')[0]])

      const lastMonthPaid = parseFloat(lastMonthPayment[0]?.total_paid || '0')
      const lastMonthOwed = monthlyFee - lastMonthPaid

      // Check two months ago payment
      const { rows: twoMonthsPayment } = await pool.query(`
        SELECT SUM(amount) as total_paid
        FROM membership_payments
        WHERE user_id = $1
          AND payment_month = $2
          AND status = 'paid'
      `, [member.id, twoMonthsAgo.toISOString().split('T')[0]])

      const twoMonthsPaid = parseFloat(twoMonthsPayment[0]?.total_paid || '0')
      const twoMonthsOwed = monthlyFee - twoMonthsPaid

      // Check reminder stage
      const { rows: reminderRows } = await pool.query(`
        SELECT * FROM payment_reminders
        WHERE user_id = $1 AND payment_month = $2
      `, [member.id, twoMonthsAgo.toISOString().split('T')[0]])

      const reminderStage = reminderRows[0]?.reminder_stage || 0

      let wouldSendReminder = false
      let reminderType = 'none'
      let monthAffected = ''

      // Simulate what would happen
      if (!stage || stage === 1) {
        if (dayOfMonth === 7 && lastMonthOwed > 0) {
          wouldSendReminder = true
          reminderType = 'first_reminder'
          monthAffected = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        }
      }

      if (!stage || stage === 2) {
        if (dayOfMonth === 14 && lastMonthOwed > 0 && reminderStage === 1) {
          wouldSendReminder = true
          reminderType = 'second_reminder'
          monthAffected = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        }
      }

      if (!stage || stage === 3) {
        if (dayOfMonth === 7 && twoMonthsOwed > 0 && reminderStage >= 2) {
          wouldSendReminder = true
          reminderType = finesEnabled ? 'fine_notice' : 'continued_reminder'
          monthAffected = twoMonthsAgo.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        }
      }

      if (wouldSendReminder) {
        results.push({
          member: {
            id: member.member_id,
            name: member.name,
            phone: member.phone
          },
          reminderType,
          monthAffected,
          amountOwed: reminderType === 'fine_notice' ? twoMonthsOwed + fineAmount : (reminderType.includes('first') || reminderType.includes('second') ? lastMonthOwed : twoMonthsOwed),
          lastMonthPaid,
          lastMonthOwed,
          twoMonthsPaid,
          twoMonthsOwed,
          currentReminderStage: reminderStage
        })
      }
    }

    return NextResponse.json({
      testMode: true,
      simulatedDate: testDate.toISOString().split('T')[0],
      dayOfMonth,
      settings: {
        monthlyFee,
        finesEnabled,
        fineAmount
      },
      months: {
        current: currentMonth.toISOString().split('T')[0],
        last: lastMonth.toISOString().split('T')[0],
        twoMonthsAgo: twoMonthsAgo.toISOString().split('T')[0]
      },
      totalMembers: members.length,
      remindersToSend: results.length,
      reminders: results,
      explanation: {
        day7: 'First reminders for last month + Final actions for 2 months ago',
        day14: 'Second reminders for last month',
        howToTest: {
          firstReminder: '?date=2024-12-07&stage=1',
          secondReminder: '?date=2024-12-14&stage=2',
          finalReminder: '?date=2025-01-07&stage=3'
        }
      }
    })
  } catch (err: any) {
    console.error('Test endpoint error:', err)
    return NextResponse.json({ 
      error: 'Failed to run test',
      details: err.message 
    }, { status: 500 })
  }
}

