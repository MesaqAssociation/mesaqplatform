import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function PATCH(req: NextRequest) {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    userId = decoded.userId || decoded.sub
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, email, phone, address, household_members } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    }

    // Update user
    const { rows } = await pool.query(`
      UPDATE users 
      SET 
        name = $1,
        email = $2,
        phone = $3,
        address = $4,
        household_members = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING id, name, email, phone, address, household_members
    `, [
      name.trim(),
      email?.trim() || null,
      phone.trim(),
      address?.trim() || null,
      household_members ? parseInt(household_members) : 1,
      userId
    ])

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true,
      user: rows[0]
    })
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json({ 
      error: 'Failed to update profile',
      details: error.message 
    }, { status: 500 })
  }
}

