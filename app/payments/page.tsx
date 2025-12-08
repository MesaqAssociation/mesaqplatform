import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import { Pool } from 'pg'
import PaymentsClient from './PaymentsClient'

export default async function PaymentsPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')

  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    userId = decoded.userId || decoded.sub
    if (!userId) redirect('/')
  } catch {
    redirect('/')
  }

  const user = await getUserFromToken()

  // Fetch member's own transactions
  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool

  let transactions: any[] = []
  try {
    const { rows } = await pool.query(`
      SELECT 
        t.id,
        to_char(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
        t.transaction_name,
        t.description,
        t.amount,
        t.transaction_type,
        t.category,
        t.source
      FROM transactions t
      WHERE t.matched_member_id = $1
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT 200
    `, [userId])
    transactions = rows
  } catch (error) {
    console.error('Error fetching member payments:', error)
  }

  return (
    <MainLayout user={user}>
      <PaymentsClient transactions={transactions} />
    </MainLayout>
  )
}

