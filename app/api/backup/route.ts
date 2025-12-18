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

    // Check if user is admin
    const { rows: roleRows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    const role = (roleRows[0]?.role || '').toLowerCase()
    if (!['admin', 'board', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Only admins can create backups' }, { status: 403 })
    }

    console.log('📦 Creating backup...')

    // Fetch all tables data
    const [
      usersResult,
      eventsResult,
      transactionsResult,
      membershipPaymentsResult,
      systemSettingsResult,
      financialAccountsResult,
      bankStatementsResult,
      memberGroupsResult,
      paymentKeywordsResult,
      scheduledNotificationsResult,
    ] = await Promise.all([
      pool.query('SELECT * FROM users'),
      pool.query('SELECT * FROM events'),
      pool.query('SELECT * FROM transactions'),
      pool.query('SELECT * FROM membership_payments'),
      pool.query('SELECT * FROM system_settings'),
      pool.query('SELECT * FROM financial_accounts'),
      pool.query('SELECT * FROM bank_statements'),
      pool.query('SELECT * FROM member_groups').catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM payment_keywords').catch(() => ({ rows: [] })),
      pool.query('SELECT * FROM scheduled_notifications').catch(() => ({ rows: [] })),
    ])

    const backupData = {
      version: '1.0',
      created_at: new Date().toISOString(),
      created_by: userId,
      tables: {
        users: usersResult.rows,
        events: eventsResult.rows,
        transactions: transactionsResult.rows,
        membership_payments: membershipPaymentsResult.rows,
        system_settings: systemSettingsResult.rows,
        financial_accounts: financialAccountsResult.rows,
        bank_statements: bankStatementsResult.rows,
        member_groups: memberGroupsResult.rows,
        payment_keywords: paymentKeywordsResult.rows,
        scheduled_notifications: scheduledNotificationsResult.rows,
      },
      counts: {
        users: usersResult.rows.length,
        events: eventsResult.rows.length,
        transactions: transactionsResult.rows.length,
        membership_payments: membershipPaymentsResult.rows.length,
        system_settings: systemSettingsResult.rows.length,
        financial_accounts: financialAccountsResult.rows.length,
        bank_statements: bankStatementsResult.rows.length,
        member_groups: memberGroupsResult.rows.length,
        payment_keywords: paymentKeywordsResult.rows.length,
        scheduled_notifications: scheduledNotificationsResult.rows.length,
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

    if (!backup || !backup.version || !backup.tables) {
      return NextResponse.json({ error: 'Invalid backup file format' }, { status: 400 })
    }

    console.log('🔄 Starting restore from backup created at:', backup.created_at)

    // Begin transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Helper to safely execute queries that might fail (table doesn't exist)
      const safeQuery = async (sql: string, params?: any[]) => {
        try {
          await client.query('SAVEPOINT safe_query')
          await client.query(sql, params)
          await client.query('RELEASE SAVEPOINT safe_query')
        } catch (err: any) {
          await client.query('ROLLBACK TO SAVEPOINT safe_query')
          console.log(`⚠️ Query skipped (table may not exist): ${sql.substring(0, 50)}...`)
        }
      }

      // Clear existing data in reverse dependency order
      await client.query('DELETE FROM membership_payments')
      await client.query('DELETE FROM transactions')
      await client.query('DELETE FROM bank_statements')
      await client.query('DELETE FROM events')
      await safeQuery('DELETE FROM scheduled_notifications')
      await safeQuery('DELETE FROM payment_keywords')
      await safeQuery('DELETE FROM member_groups')
      
      // Keep financial accounts but clear and restore
      await client.query('DELETE FROM financial_accounts')
      
      // Keep system settings
      await client.query('DELETE FROM system_settings')
      
      // Clear users last (except current user for safety)
      await client.query('DELETE FROM users WHERE id != $1', [userId])

      // Restore in dependency order
      // 1. System settings
      for (const setting of backup.tables.system_settings || []) {
        await client.query(
          'INSERT INTO system_settings (key, value, updated_at, updated_by) VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO UPDATE SET value = $2',
          [setting.key, setting.value, setting.updated_at, setting.updated_by]
        )
      }

      // 2. Financial accounts
      for (const account of backup.tables.financial_accounts || []) {
        await client.query(
          `INSERT INTO financial_accounts (id, account_name, account_number, bsb, current_balance, currency, is_donation_account, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
          [account.id, account.account_name, account.account_number, account.bsb, account.current_balance, account.currency, account.is_donation_account, account.created_at]
        )
      }

      // 3. Users (except current user)
      for (const user of backup.tables.users || []) {
        if (user.id === userId) continue // Skip current user
        await client.query(
          `INSERT INTO users (id, name, email, phone, password_hash, address, role, member_id, household_members, date_joined, created_at, group_name, is_group_leader, image)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT (id) DO NOTHING`,
          [user.id, user.name, user.email, user.phone, user.password_hash, user.address, user.role, user.member_id, user.household_members, user.date_joined, user.created_at, user.group_name, user.is_group_leader, user.image]
        )
      }

      // 4. Bank statements
      for (const stmt of backup.tables.bank_statements || []) {
        await client.query(
          `INSERT INTO bank_statements (id, account_id, file_name, file_url, statement_date_from, statement_date_to, uploaded_at, uploaded_by, transactions_imported)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
          [stmt.id, stmt.account_id, stmt.file_name, stmt.file_url, stmt.statement_date_from, stmt.statement_date_to, stmt.uploaded_at, stmt.uploaded_by, stmt.transactions_imported]
        )
      }

      // 5. Transactions
      for (const txn of backup.tables.transactions || []) {
        await client.query(
          `INSERT INTO transactions (id, account_id, transaction_date, transaction_name, description, category, amount, transaction_type, reference, balance_after, source, matched_member_id, statement_id, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (id) DO NOTHING`,
          [txn.id, txn.account_id, txn.transaction_date, txn.transaction_name, txn.description, txn.category, txn.amount, txn.transaction_type, txn.reference, txn.balance_after, txn.source, txn.matched_member_id, txn.statement_id, txn.created_by, txn.created_at]
        )
      }

      // 6. Events
      for (const event of backup.tables.events || []) {
        await client.query(
          `INSERT INTO events (id, title, description, event_date, start_time, end_time, address, cost, event_type, organizing_group, is_completed, created_at, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING`,
          [event.id, event.title, event.description, event.event_date, event.start_time, event.end_time, event.address, event.cost, event.event_type, event.organizing_group, event.is_completed, event.created_at, event.created_by]
        )
      }

      // 7. Membership payments
      for (const payment of backup.tables.membership_payments || []) {
        await client.query(
          `INSERT INTO membership_payments (id, user_id, payment_month, amount_paid, transaction_id, payment_date, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
          [payment.id, payment.user_id, payment.payment_month, payment.amount_paid, payment.transaction_id, payment.payment_date, payment.status, payment.created_at]
        )
      }

      // 8. Payment keywords (if exists)
      for (const keyword of backup.tables.payment_keywords || []) {
        await safeQuery(
          `INSERT INTO payment_keywords (id, keyword, payment_type, created_at)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [keyword.id, keyword.keyword, keyword.payment_type, keyword.created_at]
        )
      }

      // 9. Member groups (if exists)
      for (const group of backup.tables.member_groups || []) {
        await safeQuery(
          `INSERT INTO member_groups (id, name, description, created_at)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [group.id, group.name, group.description, group.created_at]
        )
      }

      // 10. Scheduled notifications (if exists)
      for (const notification of backup.tables.scheduled_notifications || []) {
        await safeQuery(
          `INSERT INTO scheduled_notifications (id, title, message, scheduled_date, status, created_by, created_at, sent_at, recipients_count, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
          [notification.id, notification.title, notification.message, notification.scheduled_date, notification.status, notification.created_by, notification.created_at, notification.sent_at, notification.recipients_count, notification.error_message]
        )
      }

      await client.query('COMMIT')
      console.log('✅ Restore completed successfully')

      return NextResponse.json({ 
        success: true, 
        message: 'Backup restored successfully',
        restored: backup.counts
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
