import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { sendBulkPaymentReminders, sendBulkAdminMessages, AdminMessageData, PaymentReminderData, formatPhoneNumber } from '@/lib/picky-assist'
import { storeSentMessagesBatch, generateBatchId, SentMessageData } from '@/lib/store-sent-message'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * Unified Daily Cron Job - Runs at 1pm AEST
 * 
 * 1. On 7th of month: Send payment reminders to members with negative balance
 * 2. Every day: Send scheduled notifications that are due
 * 3. Every day: Apply late payment fines to eligible members (if enabled)
 */
export async function GET(req: NextRequest) {
  // Optional: Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow without secret in dev or if not set
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Check if test mode is enabled - if so, skip all operations
  const isTestMode = process.env.PICKY_ASSIST_TEST_MODE === 'true'
  
  const results = {
    timestamp: new Date().toISOString(),
    testMode: isTestMode,
    paymentReminders: { sent: 0, failed: 0, skipped: 0, processed: false },
    scheduledMessages: { sent: 0, failed: 0, notificationsProcessed: 0 },
    lateFines: { applied: 0, amount: 0, skipped: 0, enabled: false },
  }

  try {
    // Get Melbourne date/time
    const melbourneNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }))
    const dayOfMonth = melbourneNow.getDate()
    
    console.log(`🕐 Daily Cron running at ${melbourneNow.toISOString()} (Melbourne day: ${dayOfMonth})`)

    // ============================================
    // 1. PAYMENT REMINDERS (7th of the month only)
    // ============================================
    if (dayOfMonth === 7) {
      console.log('📅 7th of month - Sending payment reminders')
      results.paymentReminders.processed = true
      
      try {
        const reminderResult = await sendPaymentReminders()
        results.paymentReminders = { ...results.paymentReminders, ...reminderResult }
        console.log(`✅ Payment reminders: ${reminderResult.sent} sent, ${reminderResult.skipped} skipped`)
      } catch (err) {
        console.error('❌ Payment reminders error:', err)
      }
    }

    // ============================================
    // 2. SCHEDULED NOTIFICATIONS (every day)
    // ============================================
    try {
      const scheduledResult = await sendScheduledNotifications()
      results.scheduledMessages = scheduledResult
      console.log(`✅ Scheduled notifications: ${scheduledResult.sent} sent`)
    } catch (err) {
      console.error('❌ Scheduled notifications error:', err)
    }

    // ============================================
    // 3. LATE PAYMENT FINES (every day if enabled)
    // ============================================
    try {
      const finesResult = await applyLateFines()
      results.lateFines = finesResult
      if (finesResult.enabled) {
        console.log(`✅ Late fines: ${finesResult.applied} applied, $${finesResult.amount} total`)
      } else {
        console.log('ℹ️ Late fines: disabled')
      }
    } catch (err) {
      console.error('❌ Late fines error:', err)
    }

    return NextResponse.json({
      success: true,
      message: 'Daily cron completed',
      ...results
    })
  } catch (err: any) {
    console.error('❌ Daily cron error:', err)
    return NextResponse.json({ 
      error: 'Cron failed', 
      details: err.message,
      ...results
    }, { status: 500 })
  }
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req)
}

/**
 * Send payment reminders to members with negative balance
 */
async function sendPaymentReminders(): Promise<{ sent: number; failed: number; skipped: number }> {
  // Get main membership account
  const { rows: accountRows } = await pool.query(`
    SELECT bsb, account_number FROM financial_accounts 
    WHERE is_main_membership_account = true
    LIMIT 1
  `)
  
  if (accountRows.length === 0 || !accountRows[0].bsb || !accountRows[0].account_number) {
    console.log('⚠️ No main membership account configured')
    return { sent: 0, failed: 0, skipped: 0 }
  }

  const { bsb, account_number } = accountRows[0]

  // Get monthly fee
  const { rows: feeRows } = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee' LIMIT 1"
  )
  const monthlyFee = parseFloat(feeRows[0]?.value || '40')

  // Get all members with their calculated balance
  const { rows: members } = await pool.query(`
    SELECT 
      u.id, u.name, u.phone,
      COALESCE(mp.total_paid, 0) - (months.expected_months * $1) AS balance
    FROM users u
    LEFT JOIN (
      SELECT mp.user_id, SUM(mp.amount) as total_paid
      FROM membership_payments mp
      LEFT JOIN transactions t ON t.id = mp.transaction_id
      WHERE mp.transaction_id IS NULL OR t.category = 'Membership Payment'
      GROUP BY mp.user_id
    ) mp ON mp.user_id = u.id
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS expected_months
      FROM generate_series(
        date_trunc('month', COALESCE(u.date_joined, '2025-05-01'::timestamp)),
        date_trunc('month', CURRENT_DATE),
        interval '1 month'
      ) gs
    ) months
    WHERE u.phone IS NOT NULL AND u.phone != ''
  `, [monthlyFee])

  const memberData: PaymentReminderData[] = members
    .filter((m: any) => parseFloat(m.balance) < 0)
    .map((m: any) => ({
      name: m.name,
      balance: parseFloat(m.balance),
      phone: m.phone
    }))

  if (memberData.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 }
  }

  const result = await sendBulkPaymentReminders(
    memberData,
    bsb,
    account_number,
    false // Not test mode for cron
  )

  // Store sent messages in database with FULL template content matching actual WhatsApp template
  const batchId = generateBatchId()
  const sentMessageData: SentMessageData[] = members
    .filter((m: any) => parseFloat(m.balance) < 0 && m.phone)
    .map((m: any) => ({
      messageType: 'payment_reminder' as const,
      templateId: process.env.PICKY_ASSIST_PAYMENT_TEMPLATE_ID,
      messageContent: `Salam ${m.name},\n\nYou are currently $${Math.abs(parseFloat(m.balance)).toFixed(0)} behind on your Mesaq Community Membership.\n\nPlease pay ASAP with your phone number in the description to:\nBSB: ${bsb}\nAccount Number: ${account_number}\n\nKind Regards - Mesaq Association\n----------\nسلام ${m.name}،\n\nشما فعلاً $${Math.abs(parseFloat(m.balance)).toFixed(0)} بابت حق العضویت انجمن میثاق عقب هستید.\n\nلطفاً هرچه زودتر پرداخت کنید و شماره تلفن خود را در توضیح بنویسید:\n\nBSB: ${bsb}\nAccount Number: ${account_number}\n\nتشکر – انجمن میثاق`,
      recipientPhone: formatPhoneNumber(m.phone),
      recipientName: m.name,
      recipientMemberId: m.id,
      status: result.success ? 'sent' : 'failed',
      batchId
    }))

  await storeSentMessagesBatch(pool, sentMessageData, batchId)

  return { sent: result.sent, failed: result.failed, skipped: result.skipped }
}

/**
 * Send scheduled notifications that are due
 */
async function sendScheduledNotifications(): Promise<{ sent: number; failed: number; notificationsProcessed: number }> {
  const today = new Date().toISOString().split('T')[0]

  // Get all pending notifications for today or earlier
  const { rows: dueNotifications } = await pool.query(`
    SELECT id, title, message 
    FROM scheduled_notifications 
    WHERE status = 'pending' AND scheduled_date <= $1
  `, [today])

  if (dueNotifications.length === 0) {
    return { sent: 0, failed: 0, notificationsProcessed: 0 }
  }

  // Get all members with valid phone numbers
  const { rows: members } = await pool.query(`
    SELECT id, name, phone FROM users WHERE phone IS NOT NULL AND phone != ''
  `)

  if (members.length === 0) {
    return { sent: 0, failed: 0, notificationsProcessed: dueNotifications.length }
  }

  let totalSent = 0
  let totalFailed = 0

  for (const notification of dueNotifications) {
    const adminMessages: AdminMessageData[] = members.map((member: any) => ({
      memberName: member.name,
      message: `📢 ${notification.title}\n\n${notification.message}`,
      phone: member.phone
    }))

    const result = await sendBulkAdminMessages(adminMessages)

    // Update notification status
    await pool.query(`
      UPDATE scheduled_notifications 
      SET status = 'sent', sent_at = NOW(), recipients_count = $1
      WHERE id = $2
    `, [result.sent, notification.id])

    // Store sent messages in database
    const batchId = generateBatchId()
    // Store FULL template message content
    const sentMessageData: SentMessageData[] = members.map((member: any) => ({
      messageType: 'scheduled' as const,
      templateId: process.env.PICKY_ASSIST_ADMIN_MESSAGE_TEMPLATE_ID,
      messageContent: `Salam ${member.name},\n\n📢 ${notification.title}\n\n${notification.message}\n\nKind Regards - Mesaq Association`,
      recipientPhone: formatPhoneNumber(member.phone),
      recipientName: member.name,
      recipientMemberId: member.id,
      status: result.success ? 'sent' : 'failed',
      batchId
    }))

    await storeSentMessagesBatch(pool, sentMessageData, batchId)

    totalSent += result.sent
    totalFailed += result.failed
  }

  return { sent: totalSent, failed: totalFailed, notificationsProcessed: dueNotifications.length }
}

/**
 * Apply late payment fines to eligible members
 * 
 * Logic:
 * - Only applies if fines are enabled in settings
 * - Finds members who have been overdue for 2+ months
 * - Only applies one fine per member per month
 * - Creates a transaction record for the fine
 */
async function applyLateFines(): Promise<{ enabled: boolean; applied: number; amount: number; skipped: number }> {
  // Check if fines are enabled
  const { rows: settingsRows } = await pool.query(`
    SELECT key, value FROM system_settings 
    WHERE key IN ('late_payment_fines_enabled', 'late_payment_fine_amount')
  `)

  const settings: Record<string, string> = {}
  settingsRows.forEach((row: any) => settings[row.key] = row.value)

  if (settings['late_payment_fines_enabled'] !== 'true') {
    return { enabled: false, applied: 0, amount: 0, skipped: 0 }
  }

  const fineAmount = parseFloat(settings['late_payment_fine_amount'] || '10')

  // Get monthly fee
  const { rows: feeRows } = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee' LIMIT 1"
  )
  const monthlyFee = parseFloat(feeRows[0]?.value || '40')

  // Get current month key for tracking
  const melbourneNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }))
  const currentMonthKey = `${melbourneNow.getFullYear()}-${String(melbourneNow.getMonth() + 1).padStart(2, '0')}`

  // Get first account for transactions
  const { rows: accountRows } = await pool.query(`
    SELECT id FROM financial_accounts ORDER BY created_at ASC LIMIT 1
  `)

  if (accountRows.length === 0) {
    return { enabled: true, applied: 0, amount: 0, skipped: 0 }
  }

  const accountId = accountRows[0].id

  // Find members with 2+ months overdue who haven't been fined this month
  const { rows: overdueMembers } = await pool.query(`
    WITH member_balances AS (
      SELECT 
        u.id, 
        u.name,
        u.phone,
        COALESCE(mp.total_paid, 0) - (months.expected_months * $1) AS balance,
        months.expected_months
      FROM users u
      LEFT JOIN (
        SELECT mp.user_id, SUM(mp.amount) as total_paid
        FROM membership_payments mp
        LEFT JOIN transactions t ON t.id = mp.transaction_id
        WHERE mp.transaction_id IS NULL OR t.category = 'Membership Payment'
        GROUP BY mp.user_id
      ) mp ON mp.user_id = u.id
      CROSS JOIN LATERAL (
        SELECT COUNT(*)::int AS expected_months
        FROM generate_series(
          date_trunc('month', COALESCE(u.date_joined, '2025-05-01'::timestamp)),
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        ) gs
      ) months
      WHERE u.date_joined IS NOT NULL
    )
    SELECT 
      mb.id,
      mb.name,
      mb.balance,
      -- Check if already fined this month
      EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.matched_member_id = mb.id 
          AND t.category = 'Late Payment Fine'
          AND to_char(t.transaction_date, 'YYYY-MM') = $2
      ) as already_fined
    FROM member_balances mb
    WHERE mb.balance <= -($1 * 2)  -- At least 2 months overdue
  `, [monthlyFee, currentMonthKey])

  let applied = 0
  let skipped = 0
  let totalAmount = 0

  for (const member of overdueMembers) {
    if (member.already_fined) {
      skipped++
      continue
    }

    // Create fine transaction
    try {
      await pool.query(`
        INSERT INTO transactions (
          account_id,
          transaction_date,
          transaction_name,
          description,
          category,
          amount,
          transaction_type,
          matched_member_id,
          source,
          created_at
        ) VALUES (
          $1,
          CURRENT_DATE,
          'Late Payment Fine',
          $2,
          'Late Payment Fine',
          $3,
          'debit',
          $4,
          'system_cron',
          NOW()
        )
      `, [
        accountId,
        `Late payment fine for ${member.name} - Balance: $${Math.abs(member.balance).toFixed(0)} overdue`,
        fineAmount,
        member.id
      ])

      applied++
      totalAmount += fineAmount

      console.log(`💸 Applied $${fineAmount} late fine to ${member.name} (${Math.abs(member.balance).toFixed(0)} overdue)`)
    } catch (err) {
      console.error(`Failed to apply fine to ${member.name}:`, err)
      skipped++
    }
  }

  return { enabled: true, applied, amount: totalAmount, skipped }
}

