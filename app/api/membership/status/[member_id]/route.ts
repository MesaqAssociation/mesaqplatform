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
    const memberId = resolvedParams.member_id // UUID string
    
    // Get monthly fee from system settings
    const { rows: settingsRows } = await pool.query(`
      SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'
    `)
    const monthlyFee = parseFloat(settingsRows[0]?.value || process.env.MONTHLY_FEE || '50.00')

    // Get member info by UUID
    const { rows: memberRows } = await pool.query(
      'SELECT id, member_id, name, banking_name, date_joined FROM users WHERE id = $1',
      [memberId]
    )

    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404, headers: corsHeaders })
    }

    const member = memberRows[0]

    if (!member.date_joined) {
      return NextResponse.json({
        member,
        paymentStatus: 'no_date_joined',
        message: 'No join date set for this member'
      }, { headers: corsHeaders })
    }

    // Calculate expected payment months (from join date to current month)
    const joinDate = new Date(member.date_joined)
    const currentDate = new Date()
    
    const expectedMonths: string[] = []
    let currentMonth = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1)
    const now = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)

    while (currentMonth <= now) {
      expectedMonths.push(currentMonth.toISOString().split('T')[0])
      currentMonth.setMonth(currentMonth.getMonth() + 1)
    }

    // Get actual payments - SUM all payments per month
    const { rows: payments } = await pool.query(`
      SELECT 
        mp.payment_month,
        SUM(mp.amount) as total_amount,
        MAX(mp.payment_date) as latest_payment_date,
        mp.status,
        STRING_AGG(t.description, ', ') as transaction_descriptions
      FROM membership_payments mp
      LEFT JOIN transactions t ON mp.transaction_id = t.id
      WHERE mp.user_id = $1
      GROUP BY mp.payment_month, mp.status
      ORDER BY mp.payment_month DESC
    `, [member.id])

    // Build payment map
    const paymentMap = new Map()
    payments.forEach(p => {
      const monthKey = new Date(p.payment_month).toISOString().split('T')[0]
      paymentMap.set(monthKey, {
        paid: true,
        amount: parseFloat(p.total_amount),
        paymentDate: p.latest_payment_date,
        transactionDescription: p.transaction_descriptions,
        status: p.status
      })
    })

    // Build complete status for each expected month
    const monthlyStatus = expectedMonths.map(month => {
      const payment = paymentMap.get(month)
      const monthDate = new Date(month)
      
      return {
        month: month,
        monthName: monthDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }),
        paid: !!payment,
        amount: payment?.amount || monthlyFee,
        paymentDate: payment?.paymentDate || null,
        transactionDescription: payment?.transactionDescription || null,
        status: payment ? 'PAID' : 'UNPAID'
      }
    })

    const paidCount = monthlyStatus.filter(m => m.paid).length
    const overdueCount = monthlyStatus.filter(m => !m.paid).length
    const totalExpected = expectedMonths.length
    const totalOwed = (totalExpected - paidCount) * monthlyFee

    return NextResponse.json({
      member: {
        id: member.id,
        member_id: member.member_id,
        name: member.name,
        banking_name: member.banking_name,
        date_joined: member.date_joined
      },
      paymentSummary: {
        monthlyFee,
        totalExpectedPayments: totalExpected,
        paidPayments: paidCount,
        overduePayments: overdueCount,
        totalOwed,
        isUpToDate: overdueCount === 0,
        percentagePaid: totalExpected > 0 ? Math.round((paidCount / totalExpected) * 100) : 0
      },
      monthlyStatus,
      unpaidMonths: monthlyStatus.filter(m => !m.paid).map(m => m.monthName)
    }, { headers: corsHeaders })
  } catch (err: any) {
    console.error('Get payment status error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: corsHeaders })
  }
}

