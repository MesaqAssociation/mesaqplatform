import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import MembersPageClient from './MembersPageClient'
import { Pool } from 'pg'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function MembersPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()
  
  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool
  
  // Check if user is admin
  const userRole = (user?.role || '').toLowerCase()
  const isAdminOrBoard = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer'].includes(userRole)
  
  let rows: any[]
  
  if (isAdminOrBoard) {
    // Admins see full details
    const result = await pool.query(`
    SELECT 
      u.id, 
      u.member_id, 
      u.phone, 
      u.name, 
      u.email, 
      u.address, 
      u.image, 
      u.role, 
      u.household_members,
      -- Compute balance based on membership payments vs expected months
      COALESCE(mp.total_paid, 0) - (months.expected_months * COALESCE(fee.monthly_fee, 40.0)) AS balance,
      CASE 
        WHEN COALESCE(mp.total_paid, 0) - (months.expected_months * COALESCE(fee.monthly_fee, 40.0)) >= 0 THEN 'PAID'
        ELSE 'UNPAID'
      END AS payment_status,
      mp.total_paid,
      fee.monthly_fee
    FROM users u
    CROSS JOIN (
      SELECT CAST(value AS FLOAT) as monthly_fee FROM system_settings WHERE key = 'monthly_membership_fee' LIMIT 1
    ) fee
    LEFT JOIN (
      SELECT user_id, SUM(amount) as total_paid
      FROM membership_payments
      GROUP BY user_id
    ) mp ON mp.user_id = u.id
    CROSS JOIN (
      SELECT COUNT(*)::int AS expected_months
      FROM generate_series(
        date_trunc('month', COALESCE(u.date_joined, u.created_at, CURRENT_DATE)),
        date_trunc('month', CURRENT_DATE),
        interval '1 month'
      ) gs
    ) months
    ORDER BY u.name ASC 
    LIMIT 200
  `)
    rows = result.rows
  } else {
    // Regular members see only names and member IDs
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.member_id, 
        u.name, 
        u.image,
        NULL as phone,
        NULL as email,
        NULL as address,
        NULL as role,
        NULL as household_members,
      NULL as current_balance,
        NULL as payment_status,
        NULL as total_paid,
        NULL as monthly_fee
      FROM users u
      ORDER BY u.name ASC 
      LIMIT 200
    `)
    rows = result.rows
  }
  
  return (
    <MainLayout user={{ ...user, role: user?.role }}>
      <MembersPageWrapper initial={rows} isAdmin={isAdminOrBoard} />
    </MainLayout>
  )
}

function MembersPageWrapper({ initial, isAdmin }: { initial: any[], isAdmin: boolean }) {
  return <MembersPageClient initial={initial} isAdmin={isAdmin} />
}


