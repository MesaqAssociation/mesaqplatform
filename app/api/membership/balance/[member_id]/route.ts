import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ member_id: string }> | { member_id: string } }
) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Await params if it's a Promise (Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params
    const memberId = parseInt(resolvedParams.member_id)
    
    // Get monthly fee from system settings
    const { rows: settingsRows } = await pool.query(`
      SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'
    `)
    const monthlyFee = parseFloat(settingsRows[0]?.value || process.env.MONTHLY_FEE || '50.00')

    // Get member info
    const { rows: memberRows } = await pool.query(
      'SELECT id, member_id, name, created_at, date_joined FROM users WHERE member_id = $1',
      [memberId]
    )

    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const member = memberRows[0]
    
    // Use created_at month as the start - ALL members should have paid by the 1st of the next month
    const startDate = member.created_at ? new Date(member.created_at) : new Date()
    const currentDate = new Date()
    
    // Generate list of months from created_at to current month
    const months: Array<{ month: string, monthName: string }> = []
    let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const now = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    
    while (currentMonth <= now) {
      const monthStr = currentMonth.toISOString().split('T')[0]
      const monthName = currentMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
      months.push({ month: monthStr, monthName })
      currentMonth.setMonth(currentMonth.getMonth() + 1)
    }

    // Get all payments for this member
    const { rows: payments } = await pool.query(`
      SELECT 
        payment_month,
        SUM(amount) as total_amount
      FROM membership_payments
      WHERE user_id = $1
      GROUP BY payment_month
      ORDER BY payment_month
    `, [member.id])

    // Build payment map
    const paymentMap = new Map()
    payments.forEach(p => {
      const monthKey = new Date(p.payment_month).toISOString().split('T')[0]
      paymentMap.set(monthKey, parseFloat(p.total_amount))
    })

    // Calculate monthly balances
    // Balance represents credit (+) or debt (-)
    // Each month: new_balance = old_balance + payment - monthly_fee
    let runningBalance = 0
    const monthlyBalances = months.map(({ month, monthName }) => {
      const startBalance = runningBalance
      const payment = paymentMap.get(month) || 0
      const expected = monthlyFee
      
      // Balance calculation: start + payment - expected
      // Example: start=0, expected=40, paid=90 → end = 0 + 90 - 40 = +50 (credit)
      runningBalance = startBalance + payment - expected
      
      return {
        month,
        monthName,
        startBalance,
        endBalance: runningBalance,
        payment,
        expected
      }
    })

    // Reverse so most recent is first
    monthlyBalances.reverse()

    // Calculate status
    let status: 'caught_up' | 'ahead' | 'behind' = 'caught_up'
    if (runningBalance > 0) {
      status = 'ahead'
    } else if (runningBalance < 0) {
      status = 'behind'
    }

    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.total_amount), 0)
    const expectedPayments = months.length

    return NextResponse.json({
      currentBalance: runningBalance,
      expectedPayments,
      totalPaid,
      monthlyFee,
      monthlyBalances,
      status
    })
  } catch (err: any) {
    console.error('Get balance error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

