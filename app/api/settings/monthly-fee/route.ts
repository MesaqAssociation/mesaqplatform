import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// GET current monthly fee
export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT key, value FROM system_settings WHERE key IN ('monthly_membership_fee', 'pending_monthly_fee', 'pending_fee_effective_date')
    `)
    
    const settings: Record<string, string> = {}
    rows.forEach((r: any) => settings[r.key] = r.value)
    
    const fee = parseFloat(settings.monthly_membership_fee || '50.00')
    const pendingFee = settings.pending_monthly_fee ? parseFloat(settings.pending_monthly_fee) : null
    const effectiveDate = settings.pending_fee_effective_date || null
    
    return NextResponse.json({ fee, pendingFee, effectiveDate })
  } catch (err) {
    console.error('Get monthly fee error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST update monthly fee (Manager only)
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
    // Check if user is Manager
    const { rows: userRows } = await pool.query(
      'SELECT role, name FROM users WHERE id = $1',
      [userId]
    )
    
    if (!userRows[0] || userRows[0].role !== 'Manager') {
      return NextResponse.json({ 
        error: 'Only Manager can update the monthly fee' 
      }, { status: 403 })
    }

    const body = await req.json()
    const { fee } = body

    if (!fee || isNaN(parseFloat(fee)) || parseFloat(fee) < 0) {
      return NextResponse.json({ 
        error: 'Invalid fee amount' 
      }, { status: 400 })
    }

    const feeValue = parseFloat(fee).toFixed(2)

    // Calculate effective date (1st of next month)
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const effectiveDate = nextMonth.toISOString().split('T')[0]

    // Store as pending fee with effective date
    await pool.query(`
      INSERT INTO system_settings (key, value, updated_by, updated_at)
      VALUES ('pending_monthly_fee', $1, $2, NOW())
      ON CONFLICT (key) 
      DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2
    `, [feeValue, userId])

    await pool.query(`
      INSERT INTO system_settings (key, value, updated_by, updated_at)
      VALUES ('pending_fee_effective_date', $1, $2, NOW())
      ON CONFLICT (key) 
      DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2
    `, [effectiveDate, userId])

    return NextResponse.json({ 
      success: true,
      fee: feeValue,
      effectiveDate,
      message: `Monthly membership fee will change to $${feeValue} starting ${effectiveDate}`
    })
  } catch (err: any) {
    console.error('Update monthly fee error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

