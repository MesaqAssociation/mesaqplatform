import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function safeExec(sql: string, params?: any[]): Promise<boolean> {
  try {
    await pool.query(sql, params)
    return true
  } catch (err: any) {
    console.error(`SQL Error: ${err.message}`)
    return false
  }
}

// POST - Restore from a backup URL
export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    userId = decoded.userId || decoded.sub
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const { rows: roleRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
  const role = (roleRows[0]?.role || '').toLowerCase()
  if (!['admin', 'board', 'manager'].includes(role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const { url, confirmText } = await req.json()

    if (confirmText !== 'confirm') {
      return NextResponse.json({ error: 'Please type "confirm" to proceed' }, { status: 400 })
    }

    if (!url) {
      return NextResponse.json({ error: 'Backup URL is required' }, { status: 400 })
    }

    console.log('🔄 Fetching backup from URL:', url)

    // Fetch backup from URL
    const response = await fetch(url)
    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch backup: ${response.status}` }, { status: 400 })
    }

    const backup = await response.json()

    if (!backup.version || !backup.tables) {
      return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 })
    }

    console.log(`✅ Backup loaded: ${backup.counts?.users || 0} users, ${backup.counts?.transactions || 0} transactions`)
    console.log('🔄 Starting restore...')

    // Clear tables in order (respecting foreign keys)
    await safeExec('DELETE FROM member_events')
    await safeExec('DELETE FROM membership_payments')
    await safeExec('DELETE FROM transactions')
    await safeExec('DELETE FROM bank_statements')
    await safeExec('DELETE FROM events')
    await safeExec('DELETE FROM community_documents')
    await safeExec('DELETE FROM scheduled_notifications')
    await safeExec('DELETE FROM payment_keywords')
    await safeExec('DELETE FROM member_groups')
    await safeExec('DELETE FROM financial_accounts')
    await safeExec('DELETE FROM system_settings')
    await safeExec('DELETE FROM users WHERE id != $1', [userId])

    let restored = 0

    // 1. System settings
    for (const s of backup.tables.system_settings || []) {
      if (await safeExec(
        'INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [s.key, s.value, s.updated_at]
      )) restored++
    }

    // 2. Financial accounts
    for (const a of backup.tables.financial_accounts || []) {
      if (await safeExec(
        'INSERT INTO financial_accounts (id, account_name, account_number, bsb, current_balance, currency, is_donation_account, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
        [a.id, a.account_name, a.account_number, a.bsb, a.current_balance, a.currency || 'AUD', a.is_donation_account, a.created_at]
      )) restored++
    }

    // 3. Users (skip current user)
    for (const u of (backup.tables.users || []).filter((u: any) => u.id !== userId)) {
      if (await safeExec(
        `INSERT INTO users (id, name, email, phone, password_hash, address, role, member_id, household_members, date_joined, created_at, group_name, is_group_leader, image, banking_name, payment_identifiers, custom_data, occupation) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.email, u.phone, u.password_hash, u.address, u.role, u.member_id, u.household_members, u.date_joined, u.created_at, u.group_name, u.is_group_leader, u.image, u.banking_name, u.payment_identifiers, u.custom_data ? JSON.stringify(u.custom_data) : '{}', u.occupation]
      )) restored++
    }

    // 4. Bank statements
    for (const s of backup.tables.bank_statements || []) {
      if (await safeExec(
        `INSERT INTO bank_statements (id, account_id, file_name, file_url, statement_date_from, statement_date_to, uploaded_at, uploaded_by, file_size, file_type, transaction_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.account_id, s.file_name, s.file_url, s.statement_date_from, s.statement_date_to, s.uploaded_at, s.uploaded_by, s.file_size || 0, s.file_type || 'application/pdf', s.transaction_count || 0]
      )) restored++
    }

    // 5. Transactions
    for (const t of backup.tables.transactions || []) {
      if (await safeExec(
        `INSERT INTO transactions (id, account_id, transaction_date, transaction_name, description, category, amount, transaction_type, reference, balance_after, source, matched_member_id, statement_id, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (id) DO NOTHING`,
        [t.id, t.account_id, t.transaction_date, t.transaction_name, t.description, t.category, t.amount, t.transaction_type, t.reference, t.balance_after, t.source, t.matched_member_id, t.statement_id, t.created_by, t.created_at]
      )) restored++
    }

    // 6. Membership payments
    for (const p of backup.tables.membership_payments || []) {
      if (await safeExec(
        `INSERT INTO membership_payments (id, user_id, payment_month, amount, transaction_id, payment_date, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [p.id, p.user_id, p.payment_month, p.amount, p.transaction_id, p.payment_date, p.status, p.created_at]
      )) restored++
    }

    // 7. Events
    for (const e of backup.tables.events || []) {
      if (await safeExec(
        `INSERT INTO events (id, title, description, event_date, start_time, end_time, address, cost, event_type, organizing_group, is_completed, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING`,
        [e.id, e.title, e.description, e.event_date, e.start_time, e.end_time, e.address, e.cost || e.estimated_cost, e.event_type, e.organizing_group, e.is_completed, e.created_at, e.created_by]
      )) restored++
    }

    // 8. Payment keywords
    for (const k of backup.tables.payment_keywords || []) {
      if (await safeExec(
        `INSERT INTO payment_keywords (id, keyword, payment_type, created_at, created_by)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [k.id, k.keyword, k.payment_type, k.created_at, k.created_by]
      )) restored++
    }

    // 9. Scheduled notifications
    for (const n of backup.tables.scheduled_notifications || []) {
      if (await safeExec(
        `INSERT INTO scheduled_notifications (id, title, message, scheduled_date, status, created_by, created_at, sent_at, recipients_count, error_message, recipient_type, recipient_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
        [n.id, n.title, n.message, n.scheduled_date, n.status, n.created_by, n.created_at, n.sent_at, n.recipients_count, n.error_message, n.recipient_type, n.recipient_ids]
      )) restored++
    }

    // 10. Community documents
    for (const d of backup.tables.community_documents || []) {
      if (await safeExec(
        `INSERT INTO community_documents (id, title, description, file_name, file_url, file_size, file_type, uploaded_by, uploaded_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
        [d.id, d.title, d.description, d.file_name, d.file_url, d.file_size, d.file_type, d.uploaded_by, d.uploaded_at, d.created_at]
      )) restored++
    }

    console.log(`✅ RESTORE COMPLETE! ${restored} records restored.`)

    return NextResponse.json({
      success: true,
      restored,
      counts: backup.counts
    })
  } catch (err: any) {
    console.error('❌ Restore failed:', err)
    return NextResponse.json({ error: 'Restore failed', details: err.message }, { status: 500 })
  }
}

