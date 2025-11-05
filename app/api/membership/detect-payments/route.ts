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
    // Get monthly fee from system settings
    const { rows: settingsRows } = await pool.query(`
      SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'
    `)
    const monthlyFee = parseFloat(settingsRows[0]?.value || process.env.MONTHLY_FEE || '50.00')
    
    // Get all community members (exclude board members and head board member)
    const { rows: members } = await pool.query(`
      SELECT id, member_id, name, phone, date_joined, role
      FROM users
      WHERE 
        date_joined IS NOT NULL
        AND role NOT IN ('Board Member', 'Head Board Member')
    `)

    let totalDetected = 0
    let totalAdded = 0
    const detectionLog: any[] = []

    for (const member of members) {
      if (!member.phone) {
        detectionLog.push({ member: member.name, status: 'skipped', reason: 'no phone number' })
        continue
      }

      // Find transactions that contain this member's phone number
      // Look for 10-digit phone starting with 04
      const { rows: matchingTransactions } = await pool.query(`
        SELECT id, transaction_date, description, amount
        FROM transactions
        WHERE 
          transaction_type = 'credit'
          AND ABS(amount) = $1
          AND description ~ $2
          AND transaction_date >= $3
        ORDER BY transaction_date ASC
      `, [
        monthlyFee,
        member.phone, // Regex pattern for phone
        member.date_joined
      ])

      totalDetected += matchingTransactions.length

      for (const txn of matchingTransactions) {
        // Determine which month this payment is for based on transaction date
        const txnDate = new Date(txn.transaction_date + 'T00:00:00')
        const paymentMonth = new Date(txnDate.getFullYear(), txnDate.getMonth(), 1)
        const paymentMonthStr = paymentMonth.toISOString().split('T')[0]

        try {
          // Insert payment record (ignore if already exists)
          const { rowCount } = await pool.query(`
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
          
          if (rowCount && rowCount > 0) {
            totalAdded++
            detectionLog.push({
              member: member.name,
              phone: member.phone,
              month: paymentMonthStr,
              amount: monthlyFee,
              status: 'added'
            })
          }
        } catch (err) {
          console.error(`Failed to insert payment for ${member.name}:`, err)
          detectionLog.push({
            member: member.name,
            status: 'error',
            error: (err as Error).message
          })
        }
      }
    }

    // Log the action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, details) 
       VALUES ($1, 'detect_membership_payments', 'membership_payments', $2)`,
      [userId, JSON.stringify({ totalDetected, totalAdded, log: detectionLog })]
    )

    return NextResponse.json({ 
      success: true,
      totalDetected,
      totalAdded,
      detectionLog,
      message: `Detected ${totalDetected} potential payments, added ${totalAdded} new payment records.`
    })
  } catch (err: any) {
    console.error('Detect payments error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

