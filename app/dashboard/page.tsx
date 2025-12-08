import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import { Pool } from 'pg'
import DashboardClient from './DashboardClient'
import MemberDashboardClientNew from './MemberDashboardClientNew'

export default async function DashboardPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  let userId: string
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as { sub: string }
    userId = decoded.sub
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()
  
  // Check if user is admin/board/officer
  const userRole = (user?.role || '').toLowerCase()
  const isAdmin = ['admin', 'board', 'manager', 'finance officer', 'logistics officer', 'public officer'].includes(userRole)
  
  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool

  // If regular member, show member-specific dashboard (no server-side data)
  if (!isAdmin) {
    return (
      <MainLayout user={{ ...user, role: user?.role }}>
        <MemberDashboardClientNew
          initialData={{
            id: userId,
            name: user?.name || 'Member',
            member_id: null,
            household_members: 1,
            date_joined: new Date().toISOString()
          }}
          isAdmin={false}
        />
      </MainLayout>
    )
  }

  // Admin/Board dashboard
  let memberStats = { families: 0, total_members: 0 }
  let recentTransactions: any[] = []
  let upcomingEvents: any[] = []
  let accounts: any[] = []
  let unpaidBalances: any[] = []

  try {
    // Get member stats: families (registered members) and total members (sum of household sizes)
    // If household_members is NULL or 0, count as 1 person (the registered member)
    const { rows: stats } = await pool.query(`
      SELECT 
        COUNT(*) as families,
        SUM(GREATEST(COALESCE(household_members, 1), 1)) as total_members
      FROM users
    `)
    
    memberStats = {
      families: parseInt(stats[0]?.families) || 0,
      total_members: parseInt(stats[0]?.total_members) || 0
    }
  } catch (error) {
    console.error('Error fetching member stats:', error)
  }

  try {
    // Get all financial accounts with current balances
    const { rows } = await pool.query(`
      SELECT id, account_name, account_number, current_balance
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

  try {
    // Get members with unpaid balances (negative balance = owes money)
    // Show worst offenders first (most negative), then positive balances
    const { rows } = await pool.query(`
      SELECT 
        u.id,
        u.member_id,
        u.name,
        u.current_balance
      FROM users u
      WHERE u.current_balance IS NOT NULL AND u.current_balance != 0
      ORDER BY u.current_balance ASC
      LIMIT 10
    `)
    unpaidBalances = rows
    console.log(`📊 Found ${unpaidBalances.length} members with outstanding balances`)
  } catch (error) {
    console.error('Error fetching unpaid balances:', error)
  }
  
  return (
    <MainLayout user={{ ...user, role: user?.role }}>
      <DashboardClient 
        memberStats={memberStats}
        recentTransactions={recentTransactions}
        upcomingEvents={upcomingEvents}
        accounts={accounts}
        unpaidBalances={unpaidBalances}
      />
    </MainLayout>
  )
}
