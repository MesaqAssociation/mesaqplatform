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

  let memberStats = { paying_members: 0, total_members: 0 }
  let recentTransactions: any[] = []
  let upcomingEvents: any[] = []
  let accounts: any[] = []

  try {
    // Get member stats: paying members vs total members (with household)
    const { rows: stats } = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.id) as paying_members,
        COUNT(DISTINCT u.id) + COALESCE(SUM(u.household_members), 0) as total_members
      FROM users u
      LEFT JOIN current_month_payment_status cps ON u.id = cps.user_id
      WHERE cps.payment_status IS NOT NULL 
        AND cps.payment_status != 'UNPAID'
        AND cps.payment_status != 'N/A'
    `)
    
    const { rows: allMembers } = await pool.query(`
      SELECT 
        COUNT(DISTINCT id) + COALESCE(SUM(household_members), 0) as total
      FROM users
    `)
    
    memberStats = {
      paying_members: stats[0]?.paying_members || 0,
      total_members: allMembers[0]?.total || 0
    }
  } catch (error) {
    console.error('Error fetching member stats:', error)
  }

  try {
    // Get all financial accounts
    const { rows } = await pool.query(`
      SELECT id, account_name, account_number
      FROM financial_accounts
      ORDER BY created_at ASC
    `)
    accounts = rows
  } catch (error) {
    console.error('Error fetching accounts:', error)
  }

  try {
    // Get recent transactions (last 5 per account)
    const { rows } = await pool.query(`
      SELECT 
        id,
        account_id,
        transaction_date,
        transaction_name,
        description,
        amount,
        transaction_type
      FROM transactions
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT 20
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
        memberStats={memberStats}
        recentTransactions={recentTransactions}
        upcomingEvents={upcomingEvents}
        accounts={accounts}
      />
    </MainLayout>
  )
}
