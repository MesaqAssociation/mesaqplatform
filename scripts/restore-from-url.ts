/**
 * Emergency Restore Script
 * Run with: npx tsx scripts/restore-from-url.ts
 */

import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const BACKUP_URL = 'https://pub-1c75c6bf68274518bc1befb65f1b35c6.r2.dev/mesaq-association/backups/1768174022607-MesaqBackup-January-2026.json'

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

async function restore() {
  console.log('🔄 Fetching backup from URL...')
  
  const response = await fetch(BACKUP_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch backup: ${response.status}`)
  }
  
  const backup = await response.json()
  console.log(`✅ Backup loaded: ${backup.counts.users} users, ${backup.counts.transactions} transactions`)
  
  // Don't delete the current admin user - find them first
  const { rows: currentUsers } = await pool.query('SELECT id FROM users LIMIT 1')
  const keepUserId = currentUsers[0]?.id
  console.log(`🔐 Keeping current user: ${keepUserId}`)
  
  // Clear tables in order (respecting foreign keys)
  console.log('🗑️ Clearing existing data...')
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
  await safeExec('DELETE FROM users WHERE id != $1', [keepUserId])
  
  let restored = 0
  
  // 1. System settings
  console.log('📦 Restoring system_settings...')
  for (const s of backup.tables.system_settings || []) {
    if (await safeExec(
      'INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [s.key, s.value, s.updated_at]
    )) restored++
  }
  
  // 2. Financial accounts
  console.log('📦 Restoring financial_accounts...')
  for (const a of backup.tables.financial_accounts || []) {
    if (await safeExec(
      'INSERT INTO financial_accounts (id, account_name, account_number, bsb, current_balance, currency, is_donation_account, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
      [a.id, a.account_name, a.account_number, a.bsb, a.current_balance, a.currency || 'AUD', a.is_donation_account, a.created_at]
    )) restored++
  }
  
  // 3. Users (skip current user)
  console.log('📦 Restoring users...')
  for (const u of (backup.tables.users || []).filter((u: any) => u.id !== keepUserId)) {
    if (await safeExec(
      `INSERT INTO users (id, name, email, phone, password_hash, address, role, member_id, household_members, date_joined, created_at, group_name, is_group_leader, image, banking_name, payment_identifiers, custom_data, occupation) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT (id) DO NOTHING`,
      [u.id, u.name, u.email, u.phone, u.password_hash, u.address, u.role, u.member_id, u.household_members, u.date_joined, u.created_at, u.group_name, u.is_group_leader, u.image, u.banking_name, u.payment_identifiers, u.custom_data ? JSON.stringify(u.custom_data) : '{}', u.occupation]
    )) restored++
  }
  
  // 4. Bank statements
  console.log('📦 Restoring bank_statements...')
  for (const s of backup.tables.bank_statements || []) {
    if (await safeExec(
      `INSERT INTO bank_statements (id, account_id, file_name, file_url, statement_date_from, statement_date_to, uploaded_at, uploaded_by, file_size, file_type, transaction_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
      [s.id, s.account_id, s.file_name, s.file_url, s.statement_date_from, s.statement_date_to, s.uploaded_at, s.uploaded_by, s.file_size || 0, s.file_type || 'application/pdf', s.transaction_count || 0]
    )) restored++
  }
  
  // 5. Transactions
  console.log('📦 Restoring transactions...')
  for (const t of backup.tables.transactions || []) {
    if (await safeExec(
      `INSERT INTO transactions (id, account_id, transaction_date, transaction_name, description, category, amount, transaction_type, reference, balance_after, source, matched_member_id, statement_id, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.account_id, t.transaction_date, t.transaction_name, t.description, t.category, t.amount, t.transaction_type, t.reference, t.balance_after, t.source, t.matched_member_id, t.statement_id, t.created_by, t.created_at]
    )) restored++
  }
  
  // 6. Membership payments
  console.log('📦 Restoring membership_payments...')
  for (const p of backup.tables.membership_payments || []) {
    if (await safeExec(
      `INSERT INTO membership_payments (id, user_id, payment_month, amount, transaction_id, payment_date, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
      [p.id, p.user_id, p.payment_month, p.amount, p.transaction_id, p.payment_date, p.status, p.created_at]
    )) restored++
  }
  
  // 7. Events
  console.log('📦 Restoring events...')
  for (const e of backup.tables.events || []) {
    if (await safeExec(
      `INSERT INTO events (id, title, description, event_date, start_time, end_time, address, cost, event_type, organizing_group, is_completed, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING`,
      [e.id, e.title, e.description, e.event_date, e.start_time, e.end_time, e.address, e.cost || e.estimated_cost, e.event_type, e.organizing_group, e.is_completed, e.created_at, e.created_by]
    )) restored++
  }
  
  // 8. Payment keywords
  console.log('📦 Restoring payment_keywords...')
  for (const k of backup.tables.payment_keywords || []) {
    if (await safeExec(
      `INSERT INTO payment_keywords (id, keyword, payment_type, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [k.id, k.keyword, k.payment_type, k.created_at, k.created_by]
    )) restored++
  }
  
  // 9. Scheduled notifications
  console.log('📦 Restoring scheduled_notifications...')
  for (const n of backup.tables.scheduled_notifications || []) {
    if (await safeExec(
      `INSERT INTO scheduled_notifications (id, title, message, scheduled_date, status, created_by, created_at, sent_at, recipients_count, error_message, recipient_type, recipient_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
      [n.id, n.title, n.message, n.scheduled_date, n.status, n.created_by, n.created_at, n.sent_at, n.recipients_count, n.error_message, n.recipient_type, n.recipient_ids]
    )) restored++
  }
  
  // 10. Community documents
  console.log('📦 Restoring community_documents...')
  for (const d of backup.tables.community_documents || []) {
    if (await safeExec(
      `INSERT INTO community_documents (id, title, description, file_name, file_url, file_size, file_type, uploaded_by, uploaded_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
      [d.id, d.title, d.description, d.file_name, d.file_url, d.file_size, d.file_type, d.uploaded_by, d.uploaded_at, d.created_at]
    )) restored++
  }
  
  console.log(`\n✅ RESTORE COMPLETE! ${restored} records restored.`)
  console.log(`   Users: ${backup.counts.users}`)
  console.log(`   Transactions: ${backup.counts.transactions}`)
  console.log(`   Membership Payments: ${backup.counts.membership_payments}`)
  
  await pool.end()
}

restore().catch(err => {
  console.error('❌ Restore failed:', err)
  process.exit(1)
})

