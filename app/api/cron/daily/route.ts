import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { sendBulkSMS, formatPhoneNumber, buildPaymentReminderMessage, buildAdminMessage, SMSMessage } from '@/lib/mobile-message'
import { storeSentMessagesBatch, generateBatchId, SentMessageData } from '@/lib/store-sent-message'
import { uploadToR2, isR2Configured } from '@/lib/cloudflare-r2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes - requires Vercel Pro

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
 * Respects payment plans: monthly, quarterly, semi_annually, yearly
 * 
 * Payment plan reminder schedule:
 * - Monthly: Every month (7th)
 * - Quarterly: April, August, December (7th)
 * - Semi-annually: July, January (7th)
 * - Yearly: January only (7th)
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

  // Get current month (1-12)
  const currentMonth = new Date().getMonth() + 1 // 1 = January, 12 = December
  
  // Determine which payment plans should get reminders this month
  // Monthly: every month
  // Quarterly: January (1), April (4), July (7), October (10)
  // Semi-annually: January (1), July (7)
  // Yearly: January (1) only
  const quarterlyMonths = [1, 4, 7, 10]
  const semiAnnualMonths = [1, 7]
  const yearlyMonths = [1]
  
  // Build the payment plan filter
  const eligiblePlans: string[] = ['monthly'] // Monthly always gets reminders
  if (quarterlyMonths.includes(currentMonth)) {
    eligiblePlans.push('quarterly')
  }
  if (semiAnnualMonths.includes(currentMonth)) {
    eligiblePlans.push('semi_annually')
  }
  if (yearlyMonths.includes(currentMonth)) {
    eligiblePlans.push('yearly')
  }
  
  console.log(`📅 Current month: ${currentMonth}, eligible payment plans: ${eligiblePlans.join(', ')}`)

  // Get all members with their calculated balance, filtered by eligible payment plans
  // Balance calculation varies by payment plan
  const { rows: members } = await pool.query(`
    SELECT 
      u.id, u.name, u.phone, 
      COALESCE(u.payment_plan, 'monthly') as payment_plan,
      COALESCE(mp.total_paid, 0) as total_paid,
      months.expected_months,
      CASE COALESCE(u.payment_plan, 'monthly')
        WHEN 'yearly' THEN COALESCE(mp.total_paid, 0) - (FLOOR(months.expected_months / 12.0) * $1 * 12)
        WHEN 'semi_annually' THEN COALESCE(mp.total_paid, 0) - (FLOOR(months.expected_months / 6.0) * $1 * 6)
        WHEN 'quarterly' THEN COALESCE(mp.total_paid, 0) - (FLOOR(months.expected_months / 3.0) * $1 * 3)
        ELSE COALESCE(mp.total_paid, 0) - (months.expected_months * $1)
      END AS balance
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
    WHERE u.phone IS NOT NULL 
      AND u.phone != ''
      AND COALESCE(u.is_active, true) = true
      AND COALESCE(u.payment_plan, 'monthly') = ANY($2)
  `, [monthlyFee, eligiblePlans])

  // Filter to members with negative balance
  const membersWithDebt = members.filter((m: any) => parseFloat(m.balance) < 0 && m.phone)
  
  console.log(`📊 Found ${membersWithDebt.length} members with debt (from ${members.length} eligible members)`)

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
 * Replace variables in message with member data
 * Variables: {{name}}, {{phone}}, {{group}}
 */
function replaceVariables(message: string, member: any): string {
  return message
    .replace(/\{\{name\}\}/gi, member.name || 'N/A')
    .replace(/\{\{phone\}\}/gi, member.phone || 'N/A')
    .replace(/\{\{group\}\}/gi, member.group_name || 'N/A')
}

/**
 * Build scheduled message content with variable replacement
 */
function buildScheduledMessage(memberName: string, title: string, messageBody: string, member: any): string {
  // Replace variables in the message body
  const processedMessage = replaceVariables(messageBody, member)
  return `Salam ${memberName},\n\n📢 ${title}\n\n${processedMessage}\n\nKind Regards - Mesaq Association`
}

/**
 * Send scheduled notifications that are due
 */
async function sendScheduledNotifications(): Promise<{ sent: number; failed: number; notificationsProcessed: number }> {
  const today = new Date().toISOString().split('T')[0]

  // Get all pending notifications for today or earlier (include recipient info)
  const { rows: dueNotifications } = await pool.query(`
    SELECT id, title, message, recipient_type, recipient_ids 
    FROM scheduled_notifications 
    WHERE status = 'pending' AND scheduled_date <= $1
  `, [today])

  if (dueNotifications.length === 0) {
    return { sent: 0, failed: 0, notificationsProcessed: 0 }
  }

  let totalSent = 0
  let totalFailed = 0

  for (const notification of dueNotifications) {
    let members: Array<{ id: string, name: string, phone: string, group_name: string | null }> = []
    
    // Get recipients based on recipient_type (include group_name for variable replacement)
    if (notification.recipient_type === 'specific' && notification.recipient_ids && notification.recipient_ids.length > 0) {
      // Get specific members
      const { rows } = await pool.query(`
        SELECT id, name, phone, group_name FROM users 
        WHERE id = ANY($1) AND phone IS NOT NULL AND phone != ''
      `, [notification.recipient_ids])
      members = rows
    } else {
      // Get all members (default: everyone)
      const { rows } = await pool.query(`
        SELECT id, name, phone, group_name FROM users WHERE phone IS NOT NULL AND phone != ''
      `)
      members = rows
    }
    
    if (members.length === 0) {
      console.log(`⚠️ Notification "${notification.title}": No recipients with phone numbers`)
      await pool.query(`
        UPDATE scheduled_notifications 
        SET status = 'sent', sent_at = NOW(), recipients_count = 0
        WHERE id = $1
      `, [notification.id])
      continue
    }

    // Prepare SMS messages with variable replacement
    const smsMessages: SMSMessage[] = members.map((member: any) => ({
      to: member.phone,
      message: buildScheduledMessage(member.name, notification.title, notification.message, member)
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
        messageContent: buildScheduledMessage(member.name, notification.title, notification.message, member),
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
    
    console.log(`✅ Notification "${notification.title}": ${result.sent} sent, ${result.failed} failed`)
  }

  return { sent: totalSent, failed: totalFailed, notificationsProcessed: dueNotifications.length }
}

/**
 * Create monthly backup and upload to R2
 * Optimized for speed - sequential queries to reduce memory, compact JSON
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

  // Sequential queries to reduce memory pressure and improve reliability
  const tables: Record<string, any[]> = {}
  const counts: Record<string, number> = {}

  // Small tables first
  const settingsResult = await pool.query('SELECT * FROM system_settings')
  tables.system_settings = settingsResult.rows
  counts.system_settings = settingsResult.rows.length

  const accountsResult = await pool.query('SELECT * FROM financial_accounts')
  tables.financial_accounts = accountsResult.rows
  counts.financial_accounts = accountsResult.rows.length

  const usersResult = await pool.query('SELECT * FROM users')
  tables.users = usersResult.rows
  counts.users = usersResult.rows.length

  const eventsResult = await pool.query('SELECT * FROM events')
  tables.events = eventsResult.rows
  counts.events = eventsResult.rows.length

  const memberEventsResult = await safeQuery('SELECT * FROM member_events')
  tables.member_events = memberEventsResult.rows
  counts.member_events = memberEventsResult.rows.length

  const statementsResult = await pool.query('SELECT * FROM bank_statements')
  tables.bank_statements = statementsResult.rows
  counts.bank_statements = statementsResult.rows.length

  const groupsResult = await safeQuery('SELECT * FROM member_groups')
  tables.member_groups = groupsResult.rows
  counts.member_groups = groupsResult.rows.length

  const keywordsResult = await safeQuery('SELECT * FROM payment_keywords')
  tables.payment_keywords = keywordsResult.rows
  counts.payment_keywords = keywordsResult.rows.length

  const notificationsResult = await safeQuery('SELECT * FROM scheduled_notifications')
  tables.scheduled_notifications = notificationsResult.rows
  counts.scheduled_notifications = notificationsResult.rows.length

  const docsResult = await safeQuery('SELECT * FROM community_documents')
  tables.community_documents = docsResult.rows
  counts.community_documents = docsResult.rows.length

  const paymentsResult = await pool.query('SELECT * FROM membership_payments')
  tables.membership_payments = paymentsResult.rows
  counts.membership_payments = paymentsResult.rows.length

  // Transactions last (usually largest)
  const transactionsResult = await pool.query('SELECT * FROM transactions')
  tables.transactions = transactionsResult.rows
  counts.transactions = transactionsResult.rows.length

  const backupData = {
    version: '2.0',
    created_at: new Date().toISOString(),
    created_by: 'cron',
    tables,
    counts
  }

  const month = melbourneDate.toLocaleString('en-US', { month: 'long' })
  const year = melbourneDate.getFullYear()
  // Compact JSON (no pretty printing) to reduce size
  const jsonString = JSON.stringify(backupData)
  const buffer = Buffer.from(jsonString, 'utf-8')
  const filename = `MesaqBackup-${month}-${year}.json`

  console.log(`📦 Backup size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)

  // Upload to R2
  const url = await uploadToR2(buffer, filename, 'application/json', 'backups')

  // Store backup record in database for reliable listing
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS backup_records (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL,
        filename TEXT NOT NULL,
        url TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        month TEXT,
        year INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    
    const keyMatch = url.match(/backups\/[^/]+\.json/)
    const key = keyMatch ? keyMatch[0] : `backups/${Date.now()}-${filename}`
    
    await pool.query(`
      INSERT INTO backup_records (key, filename, url, size, month, year)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [key, filename, url, buffer.length, month, year])
  } catch (dbErr) {
    console.error('⚠️ Failed to save backup record:', dbErr)
  }

  return { created: true, url }
}
