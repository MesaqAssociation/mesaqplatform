import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Helper function to get Melbourne date in YYYY-MM-DD format
function getMelbourneDate(): string {
  const now = new Date()
  const melbourneTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }))
  
  const day = String(melbourneTime.getDate()).padStart(2, '0')
  const month = String(melbourneTime.getMonth() + 1).padStart(2, '0')
  const year = melbourneTime.getFullYear()
  
  return `${year}-${month}-${day}`
}

// GET - Download backup
export async function GET(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    const userId = decoded.sub

    // Check if user is admin/board
    const { rows: roleRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    const role = (roleRows[0]?.role || '').toLowerCase()
    if (!['admin', 'board', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Only board members can create backups' }, { status: 403 })
    }

    console.log('📦 Creating backup...')

    // Helper to safely query tables that might not exist
    const safeQuery = async (sql: string) => {
      try {
        return await pool.query(sql)
      } catch {
        return { rows: [] }
      }
    }

    // Fetch all tables data in parallel
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
      created_by: userId,
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

    const jsonString = JSON.stringify(backupData, null, 2)
    const filename = `MesaqBackup-${getMelbourneDate()}.json`

    console.log(`✅ Backup created: ${filename}`)

    return new NextResponse(jsonString, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    console.error('Backup error:', err)
    return NextResponse.json({ error: 'Failed to create backup', details: err.message }, { status: 500 })
  }
}

// POST - Restore from backup
export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    const userId = decoded.sub

    // Check if user is admin or board member
    const { rows: roleRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    const role = (roleRows[0]?.role || '').toLowerCase()
    if (!['admin', 'board', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Only board members can restore backups' }, { status: 403 })
    }

    const { backup, confirmText } = await req.json()

    // Verify confirmation
    if (confirmText !== 'confirm') {
      return NextResponse.json({ error: 'Please type "confirm" to proceed with restore' }, { status: 400 })
    }

    if (!backup || !backup.tables) {
      return NextResponse.json({ error: 'Invalid backup file format' }, { status: 400 })
    }

    console.log('🔄 Starting restore from backup created at:', backup.created_at)

    const client = await pool.connect()
    const results: Record<string, { restored: number; skipped: number }> = {}
    
    try {
      await client.query('BEGIN')

      // Helper to restore a table with one savepoint per table (FAST)
      const restoreTable = async (
        tableName: string,
        data: any[],
        insertFn: (item: any) => Promise<void>
      ) => {
        results[tableName] = { restored: 0, skipped: 0 }
        if (!data || data.length === 0) return

        try {
          await client.query(`SAVEPOINT restore_${tableName}`)
          
          for (const item of data) {
            try {
              await insertFn(item)
              results[tableName].restored++
            } catch (err: any) {
              results[tableName].skipped++
              // Continue with next item, don't fail the whole table
            }
          }
          
          await client.query(`RELEASE SAVEPOINT restore_${tableName}`)
          console.log(`✅ ${tableName}: ${results[tableName].restored} restored, ${results[tableName].skipped} skipped`)
        } catch (err: any) {
          await client.query(`ROLLBACK TO SAVEPOINT restore_${tableName}`)
          console.log(`⚠️ ${tableName}: table restore failed, skipping`)
        }
      }

      // Helper to safely delete from table
      const safeDelete = async (sql: string, params?: any[]) => {
        try {
          await client.query(sql, params)
        } catch {
          // Table might not exist, ignore
        }
      }

      // Clear existing data in reverse dependency order
      console.log('🗑️ Clearing existing data...')
      await safeDelete('DELETE FROM member_events')
      await safeDelete('DELETE FROM membership_payments')
      await safeDelete('DELETE FROM transactions')
      await safeDelete('DELETE FROM bank_statements')
      await safeDelete('DELETE FROM events')
      await safeDelete('DELETE FROM community_documents')
      await safeDelete('DELETE FROM scheduled_notifications')
      await safeDelete('DELETE FROM payment_keywords')
      await safeDelete('DELETE FROM member_groups')
      await safeDelete('DELETE FROM financial_accounts')
      await safeDelete('DELETE FROM system_settings')
      await safeDelete('DELETE FROM users WHERE id != $1', [userId])

      // 1. System settings
      await restoreTable('system_settings', backup.tables.system_settings, async (s) => {
        await client.query(
          'INSERT INTO system_settings (key, value, updated_at, updated_by) VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [s.key, s.value, s.updated_at, s.updated_by]
        )
      })

      // 2. Financial accounts
      await restoreTable('financial_accounts', backup.tables.financial_accounts, async (a) => {
        await client.query(
          `INSERT INTO financial_accounts (id, account_name, account_number, bsb, current_balance, currency, is_donation_account, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
          [a.id, a.account_name, a.account_number, a.bsb, a.current_balance, a.currency || 'AUD', a.is_donation_account, a.created_at]
        )
      })

      // 3. Users (except current user)
      const usersToRestore = (backup.tables.users || []).filter((u: any) => u.id !== userId)
      await restoreTable('users', usersToRestore, async (u) => {
        await client.query(
          `INSERT INTO users (id, name, email, phone, password_hash, address, role, member_id, household_members, date_joined, created_at, group_name, is_group_leader, image, banking_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (id) DO NOTHING`,
          [u.id, u.name, u.email, u.phone, u.password_hash, u.address, u.role, u.member_id, u.household_members, u.date_joined, u.created_at, u.group_name, u.is_group_leader, u.image, u.banking_name]
        )
      })

      // 4. Bank statements
      await restoreTable('bank_statements', backup.tables.bank_statements, async (s) => {
        await client.query(
          `INSERT INTO bank_statements (id, account_id, file_name, file_url, statement_date_from, statement_date_to, uploaded_at, uploaded_by, file_size, file_type, transaction_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
          [s.id, s.account_id, s.file_name, s.file_url, s.statement_date_from, s.statement_date_to, s.uploaded_at, s.uploaded_by, s.file_size || 0, s.file_type || 'application/pdf', s.transaction_count || s.transactions_imported || 0]
        )
      })

      // 5. Transactions
      await restoreTable('transactions', backup.tables.transactions, async (t) => {
        await client.query(
          `INSERT INTO transactions (id, account_id, transaction_date, transaction_name, description, category, amount, transaction_type, reference, balance_after, source, matched_member_id, statement_id, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (id) DO NOTHING`,
          [t.id, t.account_id, t.transaction_date, t.transaction_name, t.description, t.category, t.amount, t.transaction_type, t.reference, t.balance_after, t.source, t.matched_member_id, t.statement_id, t.created_by, t.created_at]
        )
      })

      // 6. Events
      await restoreTable('events', backup.tables.events, async (e) => {
        await client.query(
          `INSERT INTO events (id, title, description, event_date, start_time, end_time, address, cost, event_type, organizing_group, is_completed, created_at, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING`,
          [e.id, e.title, e.description, e.event_date, e.start_time, e.end_time, e.address, e.cost || e.estimated_cost, e.event_type, e.organizing_group, e.is_completed, e.created_at, e.created_by]
        )
      })

      // 7. Member events (attendance)
      await restoreTable('member_events', backup.tables.member_events, async (me) => {
        await client.query(
          `INSERT INTO member_events (id, user_id, event_id, attended, created_at)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, event_id) DO NOTHING`,
          [me.id, me.user_id, me.event_id, me.attended, me.created_at]
        )
      })

      // 8. Membership payments
      await restoreTable('membership_payments', backup.tables.membership_payments, async (p) => {
        await client.query(
          `INSERT INTO membership_payments (id, user_id, payment_month, amount, transaction_id, payment_date, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
          [p.id, p.user_id, p.payment_month, p.amount || p.amount_paid, p.transaction_id, p.payment_date, p.status, p.created_at]
        )
      })

      // 9. Payment keywords
      await restoreTable('payment_keywords', backup.tables.payment_keywords, async (k) => {
        await client.query(
          `INSERT INTO payment_keywords (id, keyword, payment_type, created_at, created_by)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          [k.id, k.keyword, k.payment_type, k.created_at, k.created_by]
        )
      })

      // 10. Member groups
      await restoreTable('member_groups', backup.tables.member_groups, async (g) => {
        await client.query(
          `INSERT INTO member_groups (id, name, description, created_at)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [g.id, g.name, g.description, g.created_at]
        )
      })

      // 11. Scheduled notifications
      await restoreTable('scheduled_notifications', backup.tables.scheduled_notifications, async (n) => {
        await client.query(
          `INSERT INTO scheduled_notifications (id, title, message, scheduled_date, status, created_by, created_at, sent_at, recipients_count, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
          [n.id, n.title, n.message, n.scheduled_date, n.status, n.created_by, n.created_at, n.sent_at, n.recipients_count, n.error_message]
        )
      })

      // 12. Community documents
      await restoreTable('community_documents', backup.tables.community_documents, async (d) => {
        await client.query(
          `INSERT INTO community_documents (id, title, description, file_name, file_url, file_size, file_type, uploaded_by, uploaded_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
          [d.id, d.title, d.description, d.file_name, d.file_url, d.file_size, d.file_type, d.uploaded_by, d.uploaded_at, d.created_at]
        )
      })

      await client.query('COMMIT')
      console.log('✅ Restore completed successfully')

      return NextResponse.json({ 
        success: true, 
        message: 'Backup restored successfully',
        results
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err: any) {
    console.error('Restore error:', err)
    return NextResponse.json({ error: 'Failed to restore backup', details: err.message }, { status: 500 })
  }
}
