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
 * Charge a member - creates a debit transaction that reduces their balance
 * and adds an expected payment to their account
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
      'SELECT id, name, current_balance FROM users WHERE id = $1',
      [memberId]
    )

    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const member = memberRows[0]

    // Get the main membership account
    const { rows: accountRows } = await pool.query(`
      SELECT id, current_balance FROM financial_accounts 
      WHERE is_main_membership_account = true 
      LIMIT 1
    `)

    if (accountRows.length === 0) {
      return NextResponse.json({ error: 'No main membership account found' }, { status: 400 })
    }

    const account = accountRows[0]

    // Create a debit transaction (expected payment from member)
    // This is recorded as a debit because money is expected TO the account
    const transactionDate = new Date().toISOString().split('T')[0]
    
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
        created_by,
        balance_after
      ) VALUES (
        gen_random_uuid()::text,
        $1,
        $2,
        $3,
        $4,
        $5,
        'debit',
        'Member Charge',
        $6,
        'Manual Charge',
        $7,
        $8
      ) RETURNING *
    `, [
      account.id,
      transactionDate,
      `Charge: ${reason}`,
      `Manual charge for ${member.name}: ${reason}`,
      chargeAmount,
      memberId,
      userId,
      account.current_balance - chargeAmount
    ])

    // Update account balance
    await pool.query(`
      UPDATE financial_accounts 
      SET current_balance = current_balance - $1 
      WHERE id = $2
    `, [chargeAmount, account.id])

    return NextResponse.json({
      success: true,
      transaction: txnRows[0],
      memberName: member.name,
      amount: chargeAmount,
      reason
    })
  } catch (err: any) {
    console.error('Charge member error:', err)
    return NextResponse.json({ 
      error: 'Failed to charge member',
      details: err.message 
    }, { status: 500 })
  }
}

