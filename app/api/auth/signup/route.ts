import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
})

const schema = z.object({
  phone: z.string().regex(/^0\d{9}$/),
  password: z.string().min(8).max(128),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { phone, password } = schema.parse(body)

    const { rows: existing } = await pool.query('select id from "users" where phone = $1 limit 1', [phone])
    if (existing.length) {
      return NextResponse.json({ error: 'Phone already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const id = crypto.randomUUID()
    await pool.query(
      'insert into "users" (id, phone, password_hash) values ($1, $2, $3)',
      [id, phone, passwordHash]
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}


