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

  let decoded: any
  try {
    decoded = jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = decoded.userId || decoded.sub

  try {
    const body = await req.json()
    const { memberId, months, description } = body

    if (!memberId || !months || months < 1) {
      return NextResponse.json({ error: 'Member and months are required' }, { status: 400 })
    }

    // Get monthly fee from settings
    const { rows: feeRows } = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
    )
    const monthlyFee = parseFloat(feeRows[0]?.value || '40.00')

    // Calculate total amount
    const totalAmount = monthlyFee * months

    // Get member details
    const { rows: memberRows } = await pool.query(
      'SELECT name, date_joined FROM users WHERE id = $1',
      [memberId]
    )

    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const member = memberRows[0]
    const startDate = new Date()

    // Create membership_payments for each month
    const payments = []
    for (let i = 0; i < months; i++) {
      const paymentMonth = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1)
      const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

      const { rows: inserted } = await pool.query(`
        INSERT INTO membership_payments (user_id, payment_month, amount_paid, payment_date, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, payment_month, amount_paid
      `, [memberId, paymentMonthStr, monthlyFee, startDate.toISOString().split('T')[0], description || `Advance payment for ${months} month(s)`])

      payments.push(inserted[0])
    }

    // Audit log removed - logs system no longer in use

    const expiryDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, 0)

    return NextResponse.json({
      success: true,
      memberName: member.name,
      months,
      monthlyFee,
      totalAmount,
      paymentsCreated: payments.length,
      expiryDate: expiryDate.toISOString().split('T')[0],
      message: `Successfully recorded ${months} month(s) of advance payments for ${member.name}`
    })

  } catch (err: any) {
    console.error('Advance payment error:', err)
    return NextResponse.json({
      error: 'Failed to record advance payment',
      details: err.message
    }, { status: 500 })
  }
}

