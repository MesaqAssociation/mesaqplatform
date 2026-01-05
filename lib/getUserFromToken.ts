import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { Pool } from 'pg'

export async function getUserFromToken() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) return null

  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
    })

    const { rows } = await pool.query(
      'SELECT id, name, email, image, role FROM users WHERE id = $1 LIMIT 1',
      [decoded.sub]
    )

    return rows[0] || null
  } catch {
    return null
  }
}

