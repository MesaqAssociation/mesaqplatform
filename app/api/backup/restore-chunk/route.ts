import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'
export const maxDuration = 300

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Restore order matters for foreign keys
const RESTORE_ORDER = [
  'clear', // Special step to clear all data
  'system_settings',
  'financial_accounts', 
  'users',
  'bank_statements',
  'events',
  'payment_keywords',
  'scheduled_notifications',
  'community_documents',
  'transactions',
  'membership_payments',
]

// POST - Restore one chunk at a time
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
    const { url, step } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'Backup URL is required' }, { status: 400 })
    }

    const currentStep = step || 'clear'
    const stepIndex = RESTORE_ORDER.indexOf(currentStep)
    
    if (stepIndex === -1) {
      return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
    }

    console.log(`🔄 Restore step ${stepIndex + 1}/${RESTORE_ORDER.length}: ${currentStep}`)

    // Fetch backup
    const response = await fetch(url)
    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch backup: ${response.status}` }, { status: 400 })
    }
    const backup = await response.json()

    let restored = 0

    if (currentStep === 'clear') {
      // Clear all tables
      console.log('🗑️ Clearing existing data...')
      await pool.query('DELETE FROM member_events').catch(() => {})
      await pool.query('DELETE FROM membership_payments').catch(() => {})
      await pool.query('DELETE FROM transactions').catch(() => {})
      await pool.query('DELETE FROM bank_statements').catch(() => {})
      await pool.query('DELETE FROM events').catch(() => {})
      await pool.query('DELETE FROM community_documents').catch(() => {})
      await pool.query('DELETE FROM scheduled_notifications').catch(() => {})
      await pool.query('DELETE FROM payment_keywords').catch(() => {})
      await pool.query('DELETE FROM member_groups').catch(() => {})
      await pool.query('DELETE FROM financial_accounts').catch(() => {})
      await pool.query('DELETE FROM system_settings').catch(() => {})
      await pool.query('DELETE FROM users WHERE id != $1', [userId]).catch(() => {})
      console.log('✅ Data cleared')
    } 
    else if (currentStep === 'system_settings') {
      for (const s of backup.tables.system_settings || []) {
        try {
          await pool.query(
            'INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
            [s.key, s.value, s.updated_at]
          )
          restored++
        } catch {}
      }
    }
    else if (currentStep === 'financial_accounts') {
      for (const a of backup.tables.financial_accounts || []) {
        try {
          await pool.query(
            'INSERT INTO financial_accounts (id, account_name, account_number, bsb, current_balance, currency, is_donation_account, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
            [a.id, a.account_name, a.account_number, a.bsb, a.current_balance, a.currency || 'AUD', a.is_donation_account, a.created_at]
          )
          restored++
        } catch {}
      }
    }
    else if (currentStep === 'users') {
      for (const u of (backup.tables.users || []).filter((u: any) => u.id !== userId)) {
        try {
          await pool.query(
            `INSERT INTO users (id, name, email, phone, password_hash, address, role, member_id, household_members, date_joined, created_at, group_name, is_group_leader, image, banking_name, payment_identifiers, custom_data, occupation) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) ON CONFLICT (id) DO NOTHING`,
            [u.id, u.name, u.email, u.phone, u.password_hash, u.address, u.role, u.member_id, u.household_members, u.date_joined, u.created_at, u.group_name, u.is_group_leader, u.image, u.banking_name, u.payment_identifiers, u.custom_data ? JSON.stringify(u.custom_data) : '{}', u.occupation]
          )
          restored++
        } catch {}
      }
    }
    else if (currentStep === 'bank_statements') {
      for (const s of backup.tables.bank_statements || []) {
        try {
          await pool.query(
            `INSERT INTO bank_statements (id, account_id, file_name, file_url, statement_date_from, statement_date_to, uploaded_at, uploaded_by, file_size, file_type, transaction_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
            [s.id, s.account_id, s.file_name, s.file_url, s.statement_date_from, s.statement_date_to, s.uploaded_at, s.uploaded_by, s.file_size || 0, s.file_type || 'application/pdf', s.transaction_count || 0]
          )
          restored++
        } catch {}
      }
    }
    else if (currentStep === 'events') {
      for (const e of backup.tables.events || []) {
        try {
          await pool.query(
            `INSERT INTO events (id, title, description, event_date, start_time, end_time, address, cost, event_type, organizing_group, is_completed, created_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING`,
            [e.id, e.title, e.description, e.event_date, e.start_time, e.end_time, e.address, e.cost || e.estimated_cost, e.event_type, e.organizing_group, e.is_completed, e.created_at, e.created_by]
          )
          restored++
        } catch {}
      }
    }
    else if (currentStep === 'payment_keywords') {
      for (const k of backup.tables.payment_keywords || []) {
        try {
          await pool.query(
            `INSERT INTO payment_keywords (id, keyword, payment_type, created_at, created_by)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
            [k.id, k.keyword, k.payment_type, k.created_at, k.created_by]
          )
          restored++
        } catch {}
      }
    }
    else if (currentStep === 'scheduled_notifications') {
      for (const n of backup.tables.scheduled_notifications || []) {
        try {
          await pool.query(
            `INSERT INTO scheduled_notifications (id, title, message, scheduled_date, status, created_by, created_at, sent_at, recipients_count, error_message, recipient_type, recipient_ids)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
            [n.id, n.title, n.message, n.scheduled_date, n.status, n.created_by, n.created_at, n.sent_at, n.recipients_count, n.error_message, n.recipient_type, n.recipient_ids]
          )
          restored++
        } catch {}
      }
    }
    else if (currentStep === 'community_documents') {
      for (const d of backup.tables.community_documents || []) {
        try {
          await pool.query(
            `INSERT INTO community_documents (id, title, description, file_name, file_url, file_size, file_type, uploaded_by, uploaded_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
            [d.id, d.title, d.description, d.file_name, d.file_url, d.file_size, d.file_type, d.uploaded_by, d.uploaded_at, d.created_at]
          )
          restored++
        } catch {}
      }
    }
    else if (currentStep === 'transactions') {
      for (const t of backup.tables.transactions || []) {
        try {
          await pool.query(
            `INSERT INTO transactions (id, account_id, transaction_date, transaction_name, description, category, amount, transaction_type, reference, balance_after, source, matched_member_id, statement_id, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (id) DO NOTHING`,
            [t.id, t.account_id, t.transaction_date, t.transaction_name, t.description, t.category, t.amount, t.transaction_type, t.reference, t.balance_after, t.source, t.matched_member_id, t.statement_id, t.created_by, t.created_at]
          )
          restored++
        } catch {}
      }
    }
    else if (currentStep === 'membership_payments') {
      for (const p of backup.tables.membership_payments || []) {
        try {
          await pool.query(
            `INSERT INTO membership_payments (id, user_id, payment_month, amount, transaction_id, payment_date, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
            [p.id, p.user_id, p.payment_month, p.amount, p.transaction_id, p.payment_date, p.status, p.created_at]
          )
          restored++
        } catch {}
      }
    }

    console.log(`✅ Step ${currentStep} complete: ${restored} records`)

    const nextIndex = stepIndex + 1
    const isComplete = nextIndex >= RESTORE_ORDER.length
    const nextStep = isComplete ? null : RESTORE_ORDER[nextIndex]

    return NextResponse.json({
      success: true,
      step: currentStep,
      restored,
      nextStep,
      isComplete,
      progress: `${stepIndex + 1}/${RESTORE_ORDER.length}`
    })
  } catch (err: any) {
    console.error('❌ Restore chunk error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

