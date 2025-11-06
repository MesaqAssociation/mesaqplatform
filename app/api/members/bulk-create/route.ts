import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Capitalize first letter of each word
function capitalizeName(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export async function POST(req: NextRequest) {
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
    const { accounts } = await req.json()
    
    if (!accounts || !Array.isArray(accounts)) {
      return NextResponse.json({ error: 'Invalid accounts data' }, { status: 400 })
    }

    const results = {
      success: [] as string[],
      skipped: [] as string[],
      errors: [] as { name: string; phone: string; error: string }[]
    }

    for (const line of accounts) {
      const parts = line.trim().split(' ')
      if (parts.length < 2) {
        results.errors.push({
          name: '',
          phone: line,
          error: 'Invalid format'
        })
        continue
      }

      const phone = parts[0]
      const nameParts = parts.slice(1)
      const name = capitalizeName(nameParts.join(' '))

      // Default password is their phone number
      const password = phone
      const hashedPassword = await bcrypt.hash(password, 10)

      try {
        // Check if phone already exists
        const { rows: existing } = await pool.query(
          'SELECT id, name FROM users WHERE phone = $1',
          [phone]
        )

        if (existing.length > 0) {
          results.skipped.push(`${name} (${phone}) - already exists as "${existing[0].name}"`)
          continue
        }

        // Insert new member
        await pool.query(
          `INSERT INTO users (id, name, phone, password_hash, role) 
           VALUES (gen_random_uuid()::text, $1, $2, $3, 'Community Member')`,
          [name, phone, hashedPassword]
        )

        results.success.push(`${name} (${phone})`)
      } catch (err: any) {
        results.errors.push({
          name,
          phone,
          error: err.message || 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: accounts.length,
        created: results.success.length,
        skipped: results.skipped.length,
        errors: results.errors.length
      }
    })
  } catch (err: any) {
    console.error('Bulk create error:', err)
    return NextResponse.json({ 
      error: err.message || 'Failed to create members' 
    }, { status: 500 })
  }
}

