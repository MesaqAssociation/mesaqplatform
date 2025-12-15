import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { corsHeaders } from '@/lib/cors'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const cookieToken = cookies().get('auth_token')?.value
  const token = authHeader?.replace('Bearer ', '') || cookieToken
  
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    userId = decoded.userId || decoded.sub
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { name, email, phone, address, household_members, image } = body
    
    // If only updating image
    if (image !== undefined && !name && !phone) {
      const { rows } = await pool.query(`
        UPDATE users SET image = $1 WHERE id = $2
        RETURNING id, name, email, phone, address, household_members, image
      `, [image, userId])
      
      if (rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })
      }
      
      return NextResponse.json({ success: true, user: rows[0] }, { headers: corsHeaders })
    }
    
    const household = Number.isFinite(Number(household_members)) ? Number(household_members) : 1

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: corsHeaders })
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400, headers: corsHeaders })
    }

    // Update user
    const { rows } = await pool.query(`
      UPDATE users 
      SET 
        name = $1,
        email = $2,
        phone = $3,
        address = $4,
        household_members = $5
      WHERE id = $6
      RETURNING id, name, email, phone, address, household_members, image
    `, [
      name.trim(),
      email?.trim() || null,
      phone?.trim() || null,
      address?.trim() || null,
      household,
      userId
    ])

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })
    }

    return NextResponse.json({ 
      success: true,
      user: rows[0]
    }, { headers: corsHeaders })
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json({ 
      error: 'Failed to update profile',
      details: error.message 
    }, { status: 500, headers: corsHeaders })
  }
}

