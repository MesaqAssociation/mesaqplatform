import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
})

const schema = z.object({
  phone: z.string().regex(/^0\d{9}$/),
  password: z.string().min(8).max(128),
})

async function ensureUsersTable() {
  await pool.query(`
    create table if not exists "users" (
      "id" text primary key,
      phone text unique not null,
      password_hash text not null,
      name text,
      image text,
      created_at timestamptz not null default now()
    );
    create index if not exists users_phone_idx on "users"(phone);
  `)
}

export async function POST(req: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 })
    }

    const body = await req.json()
    const { phone, password } = schema.parse(body)

    await ensureUsersTable()

    const { rows: existing } = await pool.query('select id from "users" where phone = $1 limit 1', [phone])
    if (existing.length) {
      return NextResponse.json({ error: 'Phone already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const id = randomUUID()
    await pool.query('insert into "users" (id, phone, password_hash) values ($1, $2, $3)', [id, phone, passwordHash])

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}


