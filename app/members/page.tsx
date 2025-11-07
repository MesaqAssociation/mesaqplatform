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
  
  // Fetch members with their current month payment status
  const { rows } = await pool.query(`
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
      cps.payment_status,
      cps.total_paid,
      cps.monthly_fee
    FROM users u
    LEFT JOIN current_month_payment_status cps ON u.id = cps.user_id
    ORDER BY u.name ASC 
    LIMIT 200
  `)
  return (
    <MainLayout user={user}>
      <MembersPageWrapper initial={rows} />
    </MainLayout>
  )
}

function MembersPageWrapper({ initial }: { initial: any[] }) {
  return <MembersPageClient initial={initial} />
}


