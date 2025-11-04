import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
})

export async function GET() {
  try {
    const { rows } = await pool.query('select id, phone, name from "users" order by created_at desc limit 200')
    return NextResponse.json({ members: rows })
  } catch (e) {
    return NextResponse.json({ members: [] })
  }
}


