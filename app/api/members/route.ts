import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { corsHeaders } from '@/lib/cors'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
})

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: NextRequest) {
  // Check authentication
  const authHeader = req.headers.get('Authorization')
  const cookieToken = cookies().get('auth_token')?.value
  const token = authHeader?.replace('Bearer ', '') || cookieToken
  
  if (!token || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  try {
    const { searchParams } = new URL(req.url)
    const searchQuery = searchParams.get('search')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Get members with balance calculation
    // Filter out deactivated members by default (is_active = false)
    const activeFilter = includeInactive ? '' : 'WHERE COALESCE(u.is_active, true) = true'
    const searchFilter = searchQuery 
      ? (includeInactive ? 'WHERE' : 'AND') + ` (LOWER(u.name) LIKE LOWER($1) OR LOWER(u.email) LIKE LOWER($1) OR u.phone LIKE $1 OR LOWER(u.member_id) LIKE LOWER($1))`
      : ''
    
    const query = `
      SELECT 
        u.id, 
        u.member_id, 
        u.phone, 
        u.name, 
        u.email, 
        u.address, 
        u.image, 
        u.role, 
        u.group_name,
        u.household_members,
        COALESCE(u.is_active, true) as is_active,
        COALESCE(mp.total_paid, 0) - (months.expected_months * COALESCE(fee.monthly_fee, 40.0)) AS balance,
        CASE 
          WHEN COALESCE(mp.total_paid, 0) - (months.expected_months * COALESCE(fee.monthly_fee, 40.0)) >= 0 THEN 'PAID'
          ELSE 'UNPAID'
        END AS payment_status,
        mp.total_paid,
        fee.monthly_fee
      FROM users u
      CROSS JOIN LATERAL (
        SELECT COALESCE(
          (SELECT CAST(value AS FLOAT) FROM system_settings WHERE key = 'monthly_membership_fee' LIMIT 1),
          40.0
        ) as monthly_fee
      ) fee
      LEFT JOIN (
        SELECT mp.user_id, SUM(mp.amount) as total_paid
        FROM membership_payments mp
        LEFT JOIN transactions t ON t.id = mp.transaction_id
        WHERE mp.transaction_id IS NULL 
          OR t.category = 'Membership Payment'
        GROUP BY mp.user_id
      ) mp ON mp.user_id = u.id
      CROSS JOIN LATERAL (
        SELECT COUNT(*)::int AS expected_months
        FROM generate_series(
          date_trunc('month', COALESCE(u.date_joined, '2025-05-01'::timestamp)),
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        ) gs
      ) months
      ${activeFilter}
      ${searchFilter}
      ORDER BY u.name ASC 
      LIMIT 200
    `

    const { rows } = searchQuery 
      ? await pool.query(query, [`%${searchQuery.trim()}%`])
      : await pool.query(query)

    return NextResponse.json({ members: rows }, { headers: corsHeaders })
  } catch (e) {
    console.error('Get members error:', e)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500, headers: corsHeaders })
  }
}


