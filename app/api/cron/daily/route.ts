import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { sendBulkSMS, formatPhoneNumber, buildPaymentReminderMessage, buildAdminMessage, SMSMessage } from '@/lib/mobile-message'
import { storeSentMessagesBatch, generateBatchId, SentMessageData } from '@/lib/store-sent-message'
import { uploadToR2, isR2Configured } from '@/lib/cloudflare-r2'

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
  
  const results = {
    timestamp: new Date().toISOString(),
    paymentReminders: { sent: 0, failed: 0, skipped: 0, processed: false },
    scheduledMessages: { sent: 0, failed: 0, notificationsProcessed: 0 },
    feeUpdate: { applied: false, newFee: null as string | null },
    backup: { created: false, url: null as string | null },
  }

  try {
    // Get Melbourne date/time
    const melbourneNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }))
    const dayOfMonth = melbourneNow.getDate()
    
    console.log(`🕐 Daily Cron running at ${melbourneNow.toISOString()} (Melbourne day: ${dayOfMonth})`)

    // ============================================
    // 0. APPLY PENDING FEE CHANGE (1st of the month)
    // ============================================
    if (dayOfMonth === 1) {
      console.log('📅 1st of month - Checking for pending fee changes')
      try {
        const { rows: settingsRows } = await pool.query(`
          SELECT key, value FROM system_settings 
          WHERE key IN ('pending_monthly_fee', 'pending_fee_effective_date')
        `)
        
        const settings: Record<string, string> = {}
        settingsRows.forEach((r: any) => settings[r.key] = r.value)
        
        if (settings.pending_monthly_fee && settings.pending_fee_effective_date) {
          const effectiveDate = new Date(settings.pending_fee_effective_date)
          const today = new Date(melbourneNow.toISOString().split('T')[0])
          
          if (today >= effectiveDate) {
            // Apply the pending fee
            await pool.query(`
              UPDATE system_settings 
              SET value = $1, updated_at = NOW()
              WHERE key = 'monthly_membership_fee'
            `, [settings.pending_monthly_fee])
            
            // Clear the pending fee
            await pool.query(`
              DELETE FROM system_settings 
              WHERE key IN ('pending_monthly_fee', 'pending_fee_effective_date')
            `)
            
            results.feeUpdate = { applied: true, newFee: settings.pending_monthly_fee }
            console.log(`✅ Applied pending fee: $${settings.pending_monthly_fee}`)
          }
        }
      } catch (err) {
        console.error('Error applying pending fee:', err)
      }
    }

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
    // 3. MONTHLY BACKUP (last day of month)
    // ============================================
    // Check if today is the last day of the month
    const tomorrow = new Date(melbourneNow)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isLastDayOfMonth = tomorrow.getDate() === 1

    if (isLastDayOfMonth && isR2Configured()) {
      console.log('📦 Last day of month - Creating backup')
      try {
        const backupResult = await createMonthlyBackup(melbourneNow)
        results.backup = backupResult
        console.log(`✅ Monthly backup created: ${backupResult.url}`)
      } catch (err) {
        console.error('❌ Monthly backup error:', err)
      }
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
        date_trunc('month', CURRENT_DATE) - interval '1 month',
        interval '1 month'
      ) gs
    ) months
    WHERE u.phone IS NOT NULL AND u.phone != ''
  `, [monthlyFee])

  // Filter to members with negative balance
  const membersWithDebt = members.filter((m: any) => parseFloat(m.balance) < 0 && m.phone)

  if (membersWithDebt.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 }
  }

  // Prepare SMS messages
  const smsMessages: SMSMessage[] = membersWithDebt.map((m: any) => ({
    to: m.phone,
    message: buildPaymentReminderMessage(
      m.name,
      Math.abs(parseFloat(m.balance)),
      bsb,
      account_number
    )
  }))

  const result = await sendBulkSMS(smsMessages)

  // Store sent messages in database with external message IDs
  const batchId = generateBatchId()
  const sentMessageData: SentMessageData[] = membersWithDebt.map((m: any) => {
    const phone = formatPhoneNumber(m.phone)
    // Find the matching result by phone number
    const apiResult = result.results.find(r => r.to === phone)
    
    return {
      messageType: 'payment_reminder' as const,
      templateId: undefined,
      messageContent: buildPaymentReminderMessage(m.name, Math.abs(parseFloat(m.balance)), bsb, account_number),
      recipientPhone: phone,
      recipientName: m.name,
      recipientMemberId: m.id,
      status: apiResult?.status === 'sent' ? 'sent' : apiResult?.status === 'failed' ? 'failed' : 'sent',
      externalMessageId: apiResult?.messageId || undefined,
      errorMessage: apiResult?.error || undefined,
      batchId
    }
  })

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
    // Prepare SMS messages
    const smsMessages: SMSMessage[] = members.map((member: any) => ({
      to: member.phone,
      message: buildAdminMessage(member.name, `📢 ${notification.title}\n\n${notification.message}`)
    }))

    const result = await sendBulkSMS(smsMessages)

    // Update notification status
    await pool.query(`
      UPDATE scheduled_notifications 
      SET status = 'sent', sent_at = NOW(), recipients_count = $1
      WHERE id = $2
    `, [result.sent, notification.id])

    // Store sent messages in database with external message IDs
    const batchId = generateBatchId()
    const sentMessageData: SentMessageData[] = members.map((member: any) => {
      const phone = formatPhoneNumber(member.phone)
      // Find the matching result by phone number
      const apiResult = result.results.find(r => r.to === phone)
      
      return {
        messageType: 'scheduled' as const,
        templateId: undefined,
        messageContent: buildAdminMessage(member.name, `📢 ${notification.title}\n\n${notification.message}`),
        recipientPhone: phone,
        recipientName: member.name,
        recipientMemberId: member.id,
        status: apiResult?.status === 'sent' ? 'sent' : apiResult?.status === 'failed' ? 'failed' : 'sent',
        externalMessageId: apiResult?.messageId || undefined,
        errorMessage: apiResult?.error || undefined,
        batchId
      }
    })

    await storeSentMessagesBatch(pool, sentMessageData, batchId)

    totalSent += result.sent
    totalFailed += result.failed
  }

  return { sent: totalSent, failed: totalFailed, notificationsProcessed: dueNotifications.length }
}

/**
 * Create monthly backup and upload to R2
 */
async function createMonthlyBackup(melbourneDate: Date): Promise<{ created: boolean; url: string | null }> {
  // Helper to safely query tables that might not exist
  const safeQuery = async (sql: string) => {
    try {
      return await pool.query(sql)
    } catch {
      return { rows: [] }
    }
  }

  // Fetch all tables data
  const [
    usersResult,
    eventsResult,
    memberEventsResult,
    transactionsResult,
    membershipPaymentsResult,
    systemSettingsResult,
    financialAccountsResult,
    bankStatementsResult,
    memberGroupsResult,
    paymentKeywordsResult,
    scheduledNotificationsResult,
    communityDocumentsResult,
  ] = await Promise.all([
    pool.query('SELECT * FROM users'),
    pool.query('SELECT * FROM events'),
    safeQuery('SELECT * FROM member_events'),
    pool.query('SELECT * FROM transactions'),
    pool.query('SELECT * FROM membership_payments'),
    pool.query('SELECT * FROM system_settings'),
    pool.query('SELECT * FROM financial_accounts'),
    pool.query('SELECT * FROM bank_statements'),
    safeQuery('SELECT * FROM member_groups'),
    safeQuery('SELECT * FROM payment_keywords'),
    safeQuery('SELECT * FROM scheduled_notifications'),
    safeQuery('SELECT * FROM community_documents'),
  ])

  const backupData = {
    version: '2.0',
    created_at: new Date().toISOString(),
    created_by: 'cron',
    tables: {
      users: usersResult.rows,
      events: eventsResult.rows,
      member_events: memberEventsResult.rows,
      transactions: transactionsResult.rows,
      membership_payments: membershipPaymentsResult.rows,
      system_settings: systemSettingsResult.rows,
      financial_accounts: financialAccountsResult.rows,
      bank_statements: bankStatementsResult.rows,
      member_groups: memberGroupsResult.rows,
      payment_keywords: paymentKeywordsResult.rows,
      scheduled_notifications: scheduledNotificationsResult.rows,
      community_documents: communityDocumentsResult.rows,
    },
    counts: {
      users: usersResult.rows.length,
      events: eventsResult.rows.length,
      member_events: memberEventsResult.rows.length,
      transactions: transactionsResult.rows.length,
      membership_payments: membershipPaymentsResult.rows.length,
      system_settings: systemSettingsResult.rows.length,
      financial_accounts: financialAccountsResult.rows.length,
      bank_statements: bankStatementsResult.rows.length,
      member_groups: memberGroupsResult.rows.length,
      payment_keywords: paymentKeywordsResult.rows.length,
      scheduled_notifications: scheduledNotificationsResult.rows.length,
      community_documents: communityDocumentsResult.rows.length,
    }
  }

  const month = melbourneDate.toLocaleString('en-US', { month: 'long' })
  const year = melbourneDate.getFullYear()
  const jsonString = JSON.stringify(backupData, null, 2)
  const buffer = Buffer.from(jsonString, 'utf-8')
  const filename = `MesaqBackup-${month}-${year}.json`

  // Upload to R2
  const url = await uploadToR2(buffer, filename, 'application/json', 'backups')

  return { created: true, url }
}
