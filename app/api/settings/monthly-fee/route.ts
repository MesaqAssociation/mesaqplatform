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
      SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'
    `)
    
    const fee = parseFloat(rows[0]?.value || '50.00')
    
    return NextResponse.json({ fee })
  } catch (err) {
    console.error('Get monthly fee error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST update monthly fee (Head Board Member only)
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
    // Check if user is Head Board Member
    const { rows: userRows } = await pool.query(
      'SELECT role, name FROM users WHERE id = $1',
      [userId]
    )
    
    if (!userRows[0] || userRows[0].role !== 'Head Board Member') {
      return NextResponse.json({ 
        error: 'Only Head Board Member can update the monthly fee' 
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

    // Update the monthly fee
    await pool.query(`
      INSERT INTO system_settings (key, value, updated_by)
      VALUES ('monthly_membership_fee', $1, $2)
      ON CONFLICT (key) 
      DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2
    `, [feeValue, userId])

    // Log the action
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, details) 
       VALUES ($1, $2, 'update_monthly_fee', 'system_settings', $3)`,
      [userId, userRows[0].name, JSON.stringify({ oldFee: body.oldFee, newFee: feeValue })]
    )

    return NextResponse.json({ 
      success: true,
      fee: feeValue,
      message: `Monthly membership fee updated to $${feeValue}`
    })
  } catch (err: any) {
    console.error('Update monthly fee error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

