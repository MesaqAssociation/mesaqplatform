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
  
  // Restrict members page to admins/board only
  const userRole = (user?.role || '').toLowerCase()
  const isAdminOrBoard = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer'].includes(userRole)
  if (!isAdminOrBoard) {
    redirect('/access-denied')
  }
  
  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool
  
  // Check if user is admin
  const isAdmin = user?.role === 'board' || user?.role === 'admin' || user?.role === 'Manager'
  
  let rows: any[]
  
  if (isAdmin) {
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
      NULL as payment_status,
      NULL as total_paid,
      NULL as monthly_fee
    FROM users u
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
    <MainLayout user={user}>
      <MembersPageWrapper initial={rows} isAdmin={isAdmin} />
    </MainLayout>
  )
}

function MembersPageWrapper({ initial, isAdmin }: { initial: any[], isAdmin: boolean }) {
  return <MembersPageClient initial={initial} isAdmin={isAdmin} />
}


