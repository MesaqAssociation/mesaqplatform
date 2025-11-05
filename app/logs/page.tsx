import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { Pool } from 'pg'
import LogsClient from './LogsClient'

export default async function LogsPage() {
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

  const { rows } = await pool.query(`
    SELECT * FROM audit_logs 
    ORDER BY created_at DESC 
    LIMIT 500
  `)

  return (
    <MainLayout>
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Activity Logs</h1>
        <LogsClient initial={rows} />
      </div>
    </MainLayout>
  )
}

