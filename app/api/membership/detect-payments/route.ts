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
    const monthlyFee = parseFloat(process.env.MONTHLY_FEE || '50.00')
    
    // Get all members with banking names
    const { rows: members } = await pool.query(`
      SELECT id, member_id, name, banking_name, date_joined
      FROM users
      WHERE banking_name IS NOT NULL AND date_joined IS NOT NULL
    `)

    let totalDetected = 0
    let totalAdded = 0

    for (const member of members) {
      // Find transactions that match this member's banking name and the monthly fee amount
      const { rows: matchingTransactions } = await pool.query(`
        SELECT id, transaction_date, description, amount
        FROM transactions
        WHERE 
          transaction_type = 'credit'
          AND ABS(amount) = $1
          AND (
            LOWER(description) LIKE LOWER($2)
            OR LOWER(description) LIKE LOWER($3)
          )
          AND transaction_date >= $4
        ORDER BY transaction_date ASC
      `, [
        monthlyFee,
        `%${member.banking_name}%`,
        `%${member.name}%`,
        member.date_joined
      ])

      totalDetected += matchingTransactions.length

      for (const txn of matchingTransactions) {
        // Determine which month this payment is for based on transaction date
        const paymentMonth = new Date(txn.transaction_date)
        paymentMonth.setDate(1) // First day of the month
        const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

        try {
          // Insert payment record (ignore if already exists)
          await pool.query(`
            INSERT INTO membership_payments (user_id, payment_month, amount, transaction_id, payment_date, status)
            VALUES ($1, $2, $3, $4, $5, 'paid')
            ON CONFLICT (user_id, payment_month) DO NOTHING
          `, [
            member.id,
            paymentMonthStr,
            monthlyFee,
            txn.id,
            txn.transaction_date
          ])
          totalAdded++
        } catch (err) {
          console.error(`Failed to insert payment for ${member.name}:`, err)
        }
      }
    }

    // Log the action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details) 
       VALUES ($1, 'detect_membership_payments', 'membership_payments', $2)`,
      [userId, JSON.stringify({ totalDetected, totalAdded })]
    )

    return NextResponse.json({ 
      success: true,
      totalDetected,
      totalAdded,
      message: `Detected ${totalDetected} potential payments, added ${totalAdded} new payment records.`
    })
  } catch (err: any) {
    console.error('Detect payments error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

