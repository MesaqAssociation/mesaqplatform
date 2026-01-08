import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/**
 * POST /api/finance/charge-member
 * Charge a member - creates an expected payment that reduces their balance.
 * Does NOT affect the bank account balance.
 * Use case: Member prepaid (e.g., paid Jan-May in December), need to "charge" them
 * to remove the prepaid balance so they owe that amount again.
 */
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

  // Only admins/board/officers can charge members
  const { rows: roleRows } = await pool.query('SELECT role, name FROM users WHERE id = $1', [userId])
  const role = (roleRows[0]?.role || '').toLowerCase()
  const canCharge = ['admin', 'board', 'manager', 'head', 'finance officer'].includes(role)
  if (!canCharge) {
    return NextResponse.json({ error: 'Unauthorized - Admin/Finance access required' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { memberId, amount, reason } = body

    if (!memberId || !amount || !reason) {
      return NextResponse.json({ error: 'Member, amount, and reason are required' }, { status: 400 })
    }

    const chargeAmount = parseFloat(amount)
    if (isNaN(chargeAmount) || chargeAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Get member details
    const { rows: memberRows } = await pool.query(
      'SELECT id, name FROM users WHERE id = $1',
      [memberId]
    )

    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const member = memberRows[0]

    // Get the main membership account (just for reference, we won't modify its balance)
    const { rows: accountRows } = await pool.query(`
      SELECT id FROM financial_accounts 
      WHERE is_main_membership_account = true 
      LIMIT 1
    `)

    if (accountRows.length === 0) {
      return NextResponse.json({ error: 'No main membership account found' }, { status: 400 })
    }

    const account = accountRows[0]
    const transactionDate = new Date().toISOString().split('T')[0]

    // Create a debit transaction to track the charge
    // This does NOT affect the bank account balance
    // It's marked with category 'Member Charge' so the balance calculation picks it up
    const { rows: txnRows } = await pool.query(`
      INSERT INTO transactions (
        id, 
        account_id,
        transaction_date, 
        transaction_name, 
        description, 
        amount, 
        transaction_type,
        category,
        matched_member_id,
        source,
        created_by
      ) VALUES (
        gen_random_uuid(),
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        'debit',
        'Charges',
        $6,
        'Manual Charge',
        $7
      ) RETURNING *
    `, [
      account.id,
      transactionDate,
      `Charge: ${reason}`,
      `Manual charge for ${member.name}: ${reason}`,
      chargeAmount,
      memberId,
      userId
    ])

    // NOTE: We do NOT update financial_accounts.current_balance
    // The charge only affects the member's expected payments

    return NextResponse.json({
      success: true,
      transaction: txnRows[0],
      memberName: member.name,
      amount: chargeAmount,
      reason,
      message: `Charged ${member.name} $${chargeAmount.toFixed(2)} for: ${reason}`
    })
  } catch (err: any) {
    console.error('Charge member error:', err)
    return NextResponse.json({ 
      error: 'Failed to charge member',
      details: err.message 
    }, { status: 500 })
  }
}
