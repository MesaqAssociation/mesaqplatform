import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
})

const schema = z.object({
  identifier: z.string().min(1), // Phone number or email
  password: z.string().min(8).max(128),
})

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(req: Request) {
  try {
    if (!process.env.AUTH_SECRET) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: corsHeaders })
    }

    const body = await req.json()
    const { identifier, password } = schema.parse(body)

    // Try to find user by phone or email (no longer by name to avoid duplicates)
    const { rows } = await pool.query(
      'SELECT id, password_hash, name, image, phone, role, email, address, banking_name, date_joined, household_members, member_id, COALESCE(is_active, true) as is_active FROM users WHERE phone = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
      [identifier]
    )
    const user = rows[0]
    if (!user) {
      return NextResponse.json({ error: 'No account found with this phone number or email' }, { status: 401, headers: corsHeaders })
    }
    
    // Check if account is deactivated
    if (user.is_active === false) {
      return NextResponse.json({ error: 'Your account has been deactivated. Please contact an administrator.' }, { status: 401, headers: corsHeaders })
    }
    
    if (!user.password_hash) {
      return NextResponse.json({ error: 'Account has no password set. Please contact an administrator.' }, { status: 401, headers: corsHeaders })
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401, headers: corsHeaders })
    }

    const token = jwt.sign({ sub: user.id }, process.env.AUTH_SECRET, {
      expiresIn: '7d',
    })

    const userData = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      image: user.image,
      role: user.role,
      address: user.address,
      banking_name: user.banking_name,
      date_joined: user.date_joined,
      household_members: user.household_members,
      member_id: user.member_id,
    }

    const res = NextResponse.json({ ok: true, token, user: userData }, { headers: corsHeaders })
    res.headers.append(
      'Set-Cookie',
      `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; Secure`
    )
    return res
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400, headers: corsHeaders })
    }
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500, headers: corsHeaders })
  }
}


