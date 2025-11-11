import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const searchQuery = searchParams.get('search')

    // If search query provided, search by name, email, or phone
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = `%${searchQuery.trim()}%`
      const { rows } = await pool.query(`
        SELECT id, phone, name, email, member_id, banking_name
        FROM "users" 
        WHERE 
          LOWER(name) LIKE LOWER($1) OR
          LOWER(email) LIKE LOWER($1) OR
          LOWER(phone) LIKE LOWER($1)
        ORDER BY name ASC
        LIMIT 50
      `, [searchTerm])
      return NextResponse.json({ members: rows })
    }

    // Otherwise return all members
    const { rows } = await pool.query(`
      SELECT id, phone, name, email, member_id, banking_name 
      FROM "users" 
      ORDER BY created_at DESC 
      LIMIT 200
    `)
    return NextResponse.json({ members: rows })
  } catch (e) {
    console.error('Get members error:', e)
    return NextResponse.json({ members: [] })
  }
}


