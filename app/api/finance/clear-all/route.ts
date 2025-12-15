import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function POST(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    userId = decoded.sub
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { accountId } = body

    // Get transaction IDs that will be deleted
    const { rows: transactionIds } = await pool.query(
      'SELECT id FROM transactions WHERE account_id = $1 OR account_id IS NULL',
      [accountId]
    )

    // Delete associated membership_payments (to update payment status)
    if (transactionIds.length > 0) {
      const txnIds = transactionIds.map(t => t.id)
      await pool.query(
        'DELETE FROM membership_payments WHERE transaction_id = ANY($1)',
        [txnIds]
      )
    }

    // Delete all bank statements for this account (so they can be re-uploaded)
    await pool.query(
      'DELETE FROM bank_statements WHERE account_id = $1',
      [accountId]
    )

    // Delete all transactions for this account
    const { rowCount } = await pool.query(
      'DELETE FROM transactions WHERE account_id = $1 OR account_id IS NULL',
      [accountId]
    )

    // Reset account balance to 0
    await pool.query(
      'UPDATE financial_accounts SET current_balance = 0, updated_at = NOW() WHERE id = $1',
      [accountId]
    )

    // Audit log removed - logs system no longer in use

    return NextResponse.json({ 
      success: true, 
      deletedCount: rowCount,
      message: `Successfully deleted ${rowCount} transactions.`
    })
  } catch (err: any) {
    console.error('Clear all transactions error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

