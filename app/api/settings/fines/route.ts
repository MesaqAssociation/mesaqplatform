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

  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    
    // Check if user is board member
    const { rows: userRows } = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [decoded.sub]
    )

    if (!userRows[0] || userRows[0].role !== 'board') {
      return NextResponse.json({ error: 'Only board members can update fine settings' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { enabled, amount } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled value' }, { status: 400 })
    }

    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json({ error: 'Invalid amount value' }, { status: 400 })
    }

    // Update settings
    await pool.query(`
      INSERT INTO system_settings (key, value, description)
      VALUES 
        ('late_payment_fines_enabled', $1, 'Enable fines for late payments'),
        ('late_payment_fine_amount', $2, 'Fine amount for late payments (AUD)')
      ON CONFLICT (key) 
      DO UPDATE SET value = EXCLUDED.value
    `, [enabled.toString(), amount.toFixed(2)])

    return NextResponse.json({ 
      success: true,
      settings: {
        enabled,
        amount
      }
    })
  } catch (err: any) {
    console.error('Update fine settings error:', err)
    return NextResponse.json({ 
      error: 'Failed to update settings',
      details: err.message 
    }, { status: 500 })
  }
}

