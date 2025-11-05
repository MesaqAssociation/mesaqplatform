import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import MembersClient from './MembersClient'
import { Pool } from 'pg'

export default async function MembersPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool
  const { rows } = await pool.query('select id, phone, name from "users" order by created_at desc limit 200')
  return (
    <MainLayout>
      <div className="p-6">
        <MembersClient initial={rows} />
      </div>
    </MainLayout>
  )
}


