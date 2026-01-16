import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Verify admin/board access
async function verifyAdmin(): Promise<string | null> {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) return null
  
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    const userId = decoded.userId || decoded.sub
    
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    if (rows.length === 0) return null
    
    const role = (rows[0].role || '').toLowerCase()
    const adminRoles = ['admin', 'board', 'manager', 'head', 'finance officer']
    if (!adminRoles.includes(role)) return null
    
    return userId
  } catch {
    return null
  }
}

// POST - Deactivate a member
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ member_id: string }> | { member_id: string } }
) {
  const adminId = await verifyAdmin()
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Await params if it's a Promise (Next.js 15+)
  const resolvedParams = params instanceof Promise ? await params : params
  const memberId = resolvedParams.member_id

  try {
    // Check if member exists
    const { rows: existing } = await pool.query(
      'SELECT id, name, is_active FROM users WHERE id = $1',
      [memberId]
    )

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Don't allow deactivating yourself
    if (memberId === adminId) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 })
    }

    // Toggle is_active status
    const currentlyActive = existing[0].is_active !== false // Default to true if null
    const newStatus = !currentlyActive

    if (newStatus) {
      // REACTIVATING: Clear their balance and reset date_joined
      // Get their current balance first
      const { rows: feeRows } = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
      )
      const monthlyFee = parseFloat(feeRows[0]?.value || '40.00')

      // Calculate current balance
      const { rows: balanceRows } = await pool.query(`
        SELECT 
          COALESCE(mp.total_paid, 0) - (months.expected_months * $2) as balance
        FROM users u
        LEFT JOIN (
          SELECT mp.user_id, SUM(mp.amount) as total_paid
          FROM membership_payments mp
          LEFT JOIN transactions t ON t.id = mp.transaction_id
          WHERE (mp.transaction_id IS NULL OR t.category = 'Membership Payment')
          GROUP BY mp.user_id
        ) mp ON mp.user_id = u.id
        CROSS JOIN LATERAL (
          SELECT GREATEST(0, COUNT(*)::int) AS expected_months
          FROM generate_series(
            date_trunc('month', COALESCE(u.date_joined, '2025-05-01'::timestamp)),
            date_trunc('month', CURRENT_DATE) - interval '1 month',
            interval '1 month'
          ) gs
        ) months
        WHERE u.id = $1
      `, [memberId, monthlyFee])

      const currentBalance = parseFloat(balanceRows[0]?.balance || '0')
      
      // Delete their old membership payments
      await pool.query('DELETE FROM membership_payments WHERE user_id = $1', [memberId])

      // Get the main membership account
      const { rows: accountRows } = await pool.query(
        'SELECT id FROM financial_accounts WHERE is_main_membership_account = true LIMIT 1'
      )
      const accountId = accountRows[0]?.id

      // Create a reactivation transaction if they had a balance
      if (accountId && currentBalance !== 0) {
        const today = new Date().toISOString().split('T')[0]
        const adjustmentAmount = -currentBalance // Negate to clear the balance
        await pool.query(
          `INSERT INTO transactions 
           (account_id, transaction_date, transaction_name, description, amount, transaction_type, category, matched_member_id, source) 
           VALUES ($1, $2, $3, $4, $5, 'credit', 'Special Payment', $6, 'manual')`,
          [
            accountId, 
            today, 
            `Reactivation Balance Adjustment - ${existing[0].name}`,
            `Balance cleared due to account reactivation. Previous balance: $${currentBalance.toFixed(2)}`,
            Math.abs(adjustmentAmount),
            memberId
          ]
        )
      }

      // Update user: set is_active = true and reset date_joined to current month
      await pool.query(
        'UPDATE users SET is_active = $1, date_joined = CURRENT_DATE WHERE id = $2',
        [newStatus, memberId]
      )
    } else {
      // DEACTIVATING: Just set is_active to false
      await pool.query(
        'UPDATE users SET is_active = $1 WHERE id = $2',
        [newStatus, memberId]
      )
    }

    return NextResponse.json({ 
      success: true, 
      is_active: newStatus,
      message: newStatus ? 'Member account reactivated and balance cleared' : 'Member account deactivated'
    })
  } catch (err) {
    console.error('Deactivate member error:', err)
    return NextResponse.json({ error: 'Failed to update member status' }, { status: 500 })
  }
}

