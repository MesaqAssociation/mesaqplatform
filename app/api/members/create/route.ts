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
    const { name, email, phone, password, address, image } = body
    if (!phone || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password, address, image, role) 
       VALUES ($1, $2, $3, $4, $5, $6, 'Community Member') 
       RETURNING id, name, email, phone, role`,
      [name, email || null, phone, hashed, address || null, image || null]
    )
    return NextResponse.json({ member: result.rows[0] })
  } catch (err: any) {
    console.error('Create member error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

