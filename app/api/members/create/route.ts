import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function POST(req: NextRequest) {
  // Verify admin
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
    const body = await req.json()
    const { name, email, phone, password, address, image, role, group_name, banking_name, payment_identifiers, member_id, date_joined, household_members, custom_data, occupation, payment_plan } = body
    if (!name || !phone || !password) {
      return NextResponse.json({ error: 'Name, phone number, and password are required' }, { status: 400 })
    }
    
    // Validate payment_plan
    const validPlans = ['monthly', 'quarterly', 'semi_annually', 'yearly']
    const memberPaymentPlan = validPlans.includes(payment_plan) ? payment_plan : 'monthly'

    // Check if banking_name is unique (if provided)
    if (banking_name && banking_name.trim()) {
      const { rows: existingBanking } = await pool.query(
        'SELECT id, name FROM users WHERE LOWER(banking_name) = LOWER($1)',
        [banking_name.trim()]
      )
      if (existingBanking.length > 0) {
        return NextResponse.json({ 
          error: `Banking name "${banking_name}" is already used by ${existingBanking[0].name}. Each member must have a unique banking name.` 
        }, { status: 400 })
      }
    }

    // Ensure columns exist
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_identifiers TEXT`)
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation TEXT`)
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_plan TEXT DEFAULT 'monthly'`)
    } catch {
      // Columns might already exist
    }

    const hashed = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `INSERT INTO users (id, name, email, phone, password_hash, address, image, role, group_name, banking_name, payment_identifiers, member_id, date_joined, household_members, custom_data, occupation, payment_plan) 
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
       RETURNING id, member_id, name, email, phone, role, group_name, payment_plan`,
      [name, email || null, phone, hashed, address || null, image || null, role || 'Community Member', group_name || null, banking_name || null, payment_identifiers || null, member_id || null, date_joined || null, household_members ? parseInt(household_members) : null, custom_data ? JSON.stringify(custom_data) : '{}', occupation || null, memberPaymentPlan]
    )
    return NextResponse.json({ member: result.rows[0] })
  } catch (err: any) {
    console.error('Create member error:', err)
    
    // Convert technical errors to user-friendly messages
    let userMessage = 'Failed to create member. Please try again.'
    
    if (err.code === '23505') { // Unique constraint violation
      if (err.constraint?.includes('phone')) {
        userMessage = 'This phone number is already registered. Please use a different phone number.'
      } else if (err.constraint?.includes('email')) {
        userMessage = 'This email address is already registered. Please use a different email.'
      } else {
        userMessage = 'A member with these details already exists. Please check the information and try again.'
      }
    } else if (err.code === '23503') { // Foreign key violation
      userMessage = 'Invalid reference data. Please check all fields and try again.'
    } else if (err.code === '23502') { // Not null violation
      userMessage = 'Required information is missing. Please fill in all required fields.'
    } else if (err.code === '22P02') { // Invalid input syntax
      userMessage = 'Invalid data format. Please check your input and try again.'
    }
    
    return NextResponse.json({ 
      error: userMessage
    }, { status: 400 })
  }
}

