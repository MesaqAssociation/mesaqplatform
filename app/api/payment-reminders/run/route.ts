import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { 
  sendWhatsAppMessage, 
  sendBoardNotification,
  formatPhoneNumber,
  generateFirstReminderMessage,
  generateSecondReminderMessage,
  generateFineNoticeMessage,
  generateContinuedReminderMessage,
  generateBoardNotification
} from '@/lib/whatsapp'
import { 
  getAcceleratedDate, 
  getAcceleratedDayOfMonth,
  getAcceleratedMonthStart,
  getAcceleratedPreviousMonthStart,
  getTestInfo
} from '@/lib/testTimeAcceleration'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * Run payment reminders check
 * Should be called daily by a cron job
 */
export async function POST(req: NextRequest) {
  try {
    // Optional: Verify cron secret for security
    const cronSecret = req.headers.get('x-cron-secret')
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if reminders are enabled
    const { rows: settingsRows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'whatsapp_reminders_enabled'"
    )
    
    if (settingsRows[0]?.value !== 'true') {
      return NextResponse.json({ 
        message: 'Reminders disabled', 
        sent: 0 
      })
    }

    // Use accelerated time if enabled
    const today = getAcceleratedDate()
    const dayOfMonth = getAcceleratedDayOfMonth()

    // Log test mode info if active
    const testInfo = getTestInfo()
    if (testInfo) {
      console.log(testInfo)
    }

    console.log(`🔔 Running payment reminders check for ${today.toISOString().split('T')[0]} (Day ${dayOfMonth})`)

    let remindersSent = 0
    let errors = 0

    // Get monthly fee
    const { rows: feeRows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
    )
    const monthlyFee = parseFloat(feeRows[0]?.value || '50.00')

    // Get fine settings
    const { rows: fineSettingsRows } = await pool.query(
      "SELECT key, value FROM system_settings WHERE key IN ('late_payment_fines_enabled', 'late_payment_fine_amount')"
    )
    const finesEnabled = fineSettingsRows.find(r => r.key === 'late_payment_fines_enabled')?.value === 'true'
    const fineAmount = parseFloat(fineSettingsRows.find(r => r.key === 'late_payment_fine_amount')?.value || '10.00')

    // Determine which stage of reminders to check
    if (dayOfMonth === 7) {
      // First reminder OR Final reminder
      await handleDaySevenReminders(today, monthlyFee, finesEnabled, fineAmount)
    } else if (dayOfMonth === 14) {
      // Second reminder
      await handleDayFourteenReminders(today, monthlyFee)
    } else {
      console.log(`ℹ️ Not a reminder day (day ${dayOfMonth}). Reminders sent on days 7 and 14.`)
    }

    return NextResponse.json({
      success: true,
      date: today.toISOString().split('T')[0],
      dayOfMonth,
      testMode: process.env.WHATSAPP_TEST_ACCELERATION === 'true',
      testInfo: getTestInfo(),
      remindersSent,
      errors
    })
  } catch (err: any) {
    console.error('Payment reminders error:', err)
    return NextResponse.json({ 
      error: 'Failed to run payment reminders',
      details: err.message 
    }, { status: 500 })
  }
}

/**
 * Handle 7th of month reminders
 * - First reminders for last month's unpaid fees
 * - Final reminders/fines for overdue fees
 */
async function handleDaySevenReminders(
  today: Date,
  monthlyFee: number,
  finesEnabled: boolean,
  fineAmount: number
) {
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1)

  console.log('📅 Day 7 - Checking for first reminders and final actions')

  // Get all members with their payment status
  const { rows: members } = await pool.query(`
    SELECT 
      u.id,
      u.name,
      u.phone,
      u.email
    FROM users u
    WHERE u.phone IS NOT NULL AND u.phone != ''
  `)

  for (const member of members) {
    // Check last month - send first reminder if unpaid
    const { rows: lastMonthPayment } = await pool.query(`
      SELECT SUM(amount) as total_paid
      FROM membership_payments
      WHERE user_id = $1
        AND payment_month = $2
        AND status = 'paid'
    `, [member.id, lastMonth.toISOString().split('T')[0]])

    const lastMonthPaid = parseFloat(lastMonthPayment[0]?.total_paid || '0') >= monthlyFee

    if (!lastMonthPaid) {
      // First reminder for last month
      await sendFirstReminder(member, lastMonth, monthlyFee)
    }

    // Check two months ago - send final reminder or apply fine
    const { rows: twoMonthsPayment } = await pool.query(`
      SELECT SUM(amount) as total_paid
      FROM membership_payments
      WHERE user_id = $1
        AND payment_month = $2
        AND status = 'paid'
    `, [member.id, twoMonthsAgo.toISOString().split('T')[0]])

    const twoMonthsPaid = parseFloat(twoMonthsPayment[0]?.total_paid || '0') >= monthlyFee

    if (!twoMonthsPaid) {
      // Check if already at stage 3
      const { rows: reminderRows } = await pool.query(`
        SELECT * FROM payment_reminders
        WHERE user_id = $1 AND payment_month = $2
      `, [member.id, twoMonthsAgo.toISOString().split('T')[0]])

      if (reminderRows.length > 0 && reminderRows[0].reminder_stage >= 2) {
        // Send final reminder or apply fine
        await sendFinalAction(member, twoMonthsAgo, monthlyFee, finesEnabled, fineAmount)
      }
    }
  }
}

/**
 * Handle 14th of month reminders (second reminder)
 */
async function handleDayFourteenReminders(today: Date, monthlyFee: number) {
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)

  console.log('📅 Day 14 - Checking for second reminders')

  // Get members who received first reminder and still haven't paid
  const { rows: unpaidMembers } = await pool.query(`
    SELECT 
      u.id,
      u.name,
      u.phone,
      u.email,
      pr.id as reminder_id
    FROM users u
    INNER JOIN payment_reminders pr ON u.id = pr.user_id
    WHERE pr.payment_month = $1
      AND pr.reminder_stage = 1
      AND u.phone IS NOT NULL
  `, [lastMonth.toISOString().split('T')[0]])

  for (const member of unpaidMembers) {
    // Double-check they haven't paid since first reminder
    const { rows: paymentRows } = await pool.query(`
      SELECT SUM(amount) as total_paid
      FROM membership_payments
      WHERE user_id = $1
        AND payment_month = $2
        AND status = 'paid'
    `, [member.id, lastMonth.toISOString().split('T')[0]])

    const totalPaid = parseFloat(paymentRows[0]?.total_paid || '0')

    if (totalPaid < monthlyFee) {
      // Still unpaid - send second reminder
      await sendSecondReminder(member, lastMonth, monthlyFee)
    }
  }
}

/**
 * Send first reminder
 */
async function sendFirstReminder(member: any, month: Date, amount: number) {
  const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const message = generateFirstReminderMessage(member.name, amount, monthName)
  const phone = formatPhoneNumber(member.phone)

  const sent = await sendWhatsAppMessage({ to: phone, body: message })

  if (sent) {
    // Create or update reminder record
    await pool.query(`
      INSERT INTO payment_reminders (user_id, payment_month, reminder_stage, last_reminder_date)
      VALUES ($1, $2, 1, CURRENT_DATE)
      ON CONFLICT (user_id, payment_month) 
      DO UPDATE SET 
        reminder_stage = 1,
        last_reminder_date = CURRENT_DATE,
        updated_at = NOW()
    `, [member.id, month.toISOString().split('T')[0]])

    // Send board notification
    const boardMsg = generateBoardNotification(member.name, member.phone, amount, monthName, 1)
    await sendBoardNotification(boardMsg)

    console.log(`✅ First reminder sent to ${member.name}`)
  }
}

/**
 * Send second reminder
 */
async function sendSecondReminder(member: any, month: Date, amount: number) {
  const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const message = generateSecondReminderMessage(member.name, amount, monthName)
  const phone = formatPhoneNumber(member.phone)

  const sent = await sendWhatsAppMessage({ to: phone, body: message })

  if (sent) {
    // Update reminder record
    await pool.query(`
      UPDATE payment_reminders
      SET 
        reminder_stage = 2,
        last_reminder_date = CURRENT_DATE,
        updated_at = NOW()
      WHERE user_id = $1 AND payment_month = $2
    `, [member.id, month.toISOString().split('T')[0]])

    console.log(`✅ Second reminder sent to ${member.name}`)
  }
}

/**
 * Send final action (fine or continued reminder)
 */
async function sendFinalAction(member: any, month: Date, amount: number, finesEnabled: boolean, fineAmount: number) {
  const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const phone = formatPhoneNumber(member.phone)

  let message: string
  let fineApplied = false

  if (finesEnabled) {
    // Apply fine
    message = generateFineNoticeMessage(member.name, amount, fineAmount, monthName)
    fineApplied = true

    // TODO: Create a separate fine record in a fines table if needed
  } else {
    // Continued reminder
    message = generateContinuedReminderMessage(member.name, amount, monthName)
  }

  const sent = await sendWhatsAppMessage({ to: phone, body: message })

  if (sent) {
    // Update reminder record
    await pool.query(`
      UPDATE payment_reminders
      SET 
        reminder_stage = 3,
        last_reminder_date = CURRENT_DATE,
        fine_applied = $3,
        fine_amount = $4,
        updated_at = NOW()
      WHERE user_id = $1 AND payment_month = $2
    `, [member.id, month.toISOString().split('T')[0], fineApplied, fineApplied ? fineAmount : null])

    // Send board notification
    const boardMsg = generateBoardNotification(member.name, member.phone, amount, monthName, 3)
    await sendBoardNotification(boardMsg)

    console.log(`✅ Final action sent to ${member.name} (fine: ${fineApplied})`)
  }
}

