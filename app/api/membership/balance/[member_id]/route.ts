import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { corsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ member_id: string }> | { member_id: string } }
) {
  const authHeader = req.headers.get('Authorization')
  const cookieToken = cookies().get('auth_token')?.value
  const token = authHeader?.replace('Bearer ', '') || cookieToken
  
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  try {
    // Await params if it's a Promise (Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params
    const memberId = resolvedParams.member_id
    
    // Get monthly fee from system settings
    const { rows: settingsRows } = await pool.query(`
      SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'
    `)
    const monthlyFee = parseFloat(settingsRows[0]?.value || process.env.MONTHLY_FEE || '50.00')

    // Get member info
    const { rows: memberRows } = await pool.query(
      'SELECT id, member_id, name, created_at, date_joined FROM users WHERE id = $1',
      [memberId]
    )

    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404, headers: corsHeaders })
    }

    const member = memberRows[0]
    
    // ONLY use date_joined (mandatory field) - ignore created_at
    const startDate = member.date_joined ? new Date(member.date_joined) : new Date('2025-05-01')
    const currentDate = new Date()
    
    // Generate list of months from start to PREVIOUS month (exclude current month)
    // Since statements are uploaded on the 7th, we don't expect payment for current month yet
    const months: Array<{ month: string, monthName: string }> = []
    let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    // End at previous month (current month - 1)
    const lastExpectedMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    
    while (currentMonth <= lastExpectedMonth) {
      const monthStr = currentMonth.toISOString().split('T')[0]
      const monthName = currentMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
      months.push({ month: monthStr, monthName })
      currentMonth.setMonth(currentMonth.getMonth() + 1)
    }

    // Get all MEMBERSHIP payments for this member (only true membership payments)
    // Join to transactions (if present) and keep only category = 'Membership Payment'
    const { rows: payments } = await pool.query(`
      SELECT 
        mp.payment_month,
        SUM(mp.amount) as total_amount
      FROM membership_payments mp
      LEFT JOIN transactions t ON t.id = mp.transaction_id
      WHERE mp.user_id = $1
        AND (
          mp.transaction_id IS NULL
          OR (t.category = 'Membership Payment')
        )
      GROUP BY mp.payment_month
      ORDER BY mp.payment_month
    `, [member.id])

    // Build payment map
    const paymentMap = new Map()
    payments.forEach(p => {
      const monthKey = new Date(p.payment_month).toISOString().split('T')[0]
      paymentMap.set(monthKey, parseFloat(p.total_amount || 0))
    })

    // Get total Member Charges (debit transactions with category 'Member Charge')
    // These are amounts the member owes on top of regular monthly fees
    const { rows: chargeRows } = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total_charges
      FROM transactions
      WHERE matched_member_id = $1
        AND category = 'Member Charge'
        AND transaction_type = 'debit'
    `, [member.id])
    const totalCharges = parseFloat(chargeRows[0]?.total_charges || 0)

    // Calculate membership balance
    let runningBalance = 0
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0)
    const expectedPayments = months.length
      
    // Running balance = total paid - total expected - charges
    // Charges REDUCE the balance (member owes more)
    runningBalance = totalPaid - (expectedPayments * monthlyFee) - totalCharges

    // Calculate status
    let status: 'caught_up' | 'ahead' | 'behind' = 'caught_up'
    if (runningBalance > 0) {
      status = 'ahead'
    } else if (runningBalance < 0) {
      status = 'behind'
    }

    // Get all EVENT PAYMENT transactions (category = 'Event Payment' or 'Special Payment' but NOT 'Donation')
    const { rows: eventTxns } = await pool.query(`
      SELECT 
        t.id,
        to_char(t.transaction_date, 'YYYY-MM-DD') as date,
        t.transaction_name as name,
        t.description,
        t.amount,
        t.category
      FROM transactions t
      WHERE t.matched_member_id = $1
        AND t.category IN ('Event Payment', 'Special Payment')
        AND t.transaction_type = 'credit'
      ORDER BY t.transaction_date DESC
    `, [member.id])

    const totalEventPayments = eventTxns.reduce((sum, txn) => sum + parseFloat(txn.amount || 0), 0)

    // Get all DONATION transactions
    const { rows: donationTxns } = await pool.query(`
      SELECT 
        t.id,
        to_char(t.transaction_date, 'YYYY-MM-DD') as date,
        t.transaction_name as name,
        t.description,
        t.amount
      FROM transactions t
      WHERE t.matched_member_id = $1
        AND t.category = 'Donation'
        AND t.transaction_type = 'credit'
      ORDER BY t.transaction_date DESC
    `, [member.id])

    const totalDonations = donationTxns.reduce((sum, txn) => sum + parseFloat(txn.amount || 0), 0)

    // Build month-by-month breakdown
    const monthsBreakdown = months.map(m => {
      const paidAmount = paymentMap.get(m.month) || 0
      const expected = monthlyFee
      const isPaid = paidAmount >= expected
      return {
        month: m.month,
        monthName: m.monthName,
        expected,
        paid: paidAmount,
        status: isPaid ? 'paid' : 'unpaid'
      }
    })

    // Get charge details for display
    const { rows: chargeDetails } = await pool.query(`
      SELECT 
        t.id,
        to_char(t.transaction_date, 'YYYY-MM-DD') as date,
        t.transaction_name as name,
        t.description,
        t.amount
      FROM transactions t
      WHERE t.matched_member_id = $1
        AND t.category = 'Member Charge'
        AND t.transaction_type = 'debit'
      ORDER BY t.transaction_date DESC
    `, [member.id])

    return NextResponse.json({
      membershipBalance: {
        currentBalance: runningBalance,
        expectedPayments,
        totalPaid,
        totalCharges,
        monthlyFee,
        status,
        monthsBreakdown,
        charges: chargeDetails
      },
      eventPaymentBalance: {
        totalEventPayments,
        transactions: eventTxns
      },
      donationBalance: {
        totalDonations,
        transactions: donationTxns
      },
      // Keep for backwards compatibility
      specialPaymentBalance: {
        totalSpecialPayments: totalEventPayments + totalDonations,
        transactions: [...eventTxns, ...donationTxns]
      }
    }, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Get balance error:', err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500, headers: corsHeaders })
  }
}

