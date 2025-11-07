import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import { Pool } from 'pg'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
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

  let totalMembers = 0
  let recentTransactions: any[] = []
  let upcomingEvents: any[] = []

  try {
    // Get total members (count members + sum of household members)
    const { rows: memberStats } = await pool.query(`
      SELECT 
        COUNT(*)::int as member_count,
        COALESCE(SUM(household_members), 0)::int as household_sum
      FROM users
      WHERE role IN ('Community Member', 'Board Member', 'Head Board Member')
    `)
    
    totalMembers = (memberStats[0]?.member_count || 0) + (memberStats[0]?.household_sum || 0)
  } catch (error) {
    console.error('Error fetching member stats:', error)
  }

  try {
    // Get recent transactions (last 5)
    const { rows } = await pool.query(`
      SELECT 
        id,
        transaction_date,
        transaction_name,
        description,
        amount,
        transaction_type
      FROM transactions
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT 5
    `)
    recentTransactions = rows
  } catch (error) {
    console.error('Error fetching transactions:', error)
  }

  try {
    // Get upcoming events (future events only)
    const { rows } = await pool.query(`
      SELECT 
        id,
        title,
        event_date,
        start_time,
        event_type
      FROM events
      WHERE event_date >= CURRENT_DATE
      ORDER BY event_date ASC, start_time ASC
      LIMIT 5
    `)
    upcomingEvents = rows
  } catch (error) {
    console.error('Error fetching events:', error)
  }
  
  return (
    <MainLayout user={user}>
      <DashboardClient 
        totalMembers={totalMembers}
        recentTransactions={recentTransactions}
        upcomingEvents={upcomingEvents}
      />
    </MainLayout>
  )
}
