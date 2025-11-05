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
  const { rows } = await pool.query('select id, member_id, phone, name, email, address, image, role, household_members from "users" order by created_at desc limit 200')
  return (
    <MainLayout user={user}>
      <MembersPageWrapper initial={rows} />
    </MainLayout>
  )
}

function MembersPageWrapper({ initial }: { initial: any[] }) {
  return <MembersPageClient initial={initial} />
}


