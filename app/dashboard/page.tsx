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
  let statementSummaries: any[] = []

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
        transaction_type,
        category
      FROM transactions
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT 20
    `)
    recentTransactions = rows
  } catch (error) {
    console.error('Error fetching transactions:', error)
  }

  try {
    // Get ALL statement summaries (not just latest) for historical dropdown
    // Calculate closing balance by subtracting transactions that happened AFTER this period from current balance
    const { rows } = await pool.query(`
      SELECT
        bs.id as statement_id,
        bs.account_id,
        bs.statement_date_from,
        bs.statement_date_to,
        -- Calculate closing balance: current balance minus net of transactions after this period
        fa.current_balance - COALESCE((
          SELECT SUM(
            CASE 
              WHEN t.transaction_type = 'credit' THEN t.amount 
              WHEN t.transaction_type = 'debit' THEN -ABS(t.amount)
              ELSE 0 
            END
          )
          FROM transactions t
          WHERE t.account_id = bs.account_id
            AND t.transaction_date > bs.statement_date_to
        ), 0) as closing_balance,
        (
          SELECT COALESCE(SUM(ABS(t.amount)), 0)
          FROM transactions t 
          WHERE t.account_id = bs.account_id 
            AND t.transaction_type = 'credit'
            AND t.transaction_date >= bs.statement_date_from
            AND t.transaction_date <= bs.statement_date_to
        ) as total_credits,
        (
          SELECT COALESCE(SUM(ABS(t.amount)), 0)
          FROM transactions t 
          WHERE t.account_id = bs.account_id 
            AND t.transaction_type = 'debit'
            AND t.transaction_date >= bs.statement_date_from
            AND t.transaction_date <= bs.statement_date_to
        ) as total_debits,
        (
          SELECT json_agg(json_build_object('category', sub.category, 'total', sub.total))
          FROM (
            SELECT category, COALESCE(SUM(ABS(amount)), 0) as total
            FROM transactions t
            WHERE t.account_id = bs.account_id
              AND t.transaction_type = 'credit'
              AND t.transaction_date >= bs.statement_date_from
              AND t.transaction_date <= bs.statement_date_to
            GROUP BY category
          ) sub
        ) as credit_breakdown,
        (
          SELECT json_agg(json_build_object('category', sub.category, 'total', sub.total))
          FROM (
            SELECT category, COALESCE(SUM(ABS(amount)), 0) as total
            FROM transactions t
            WHERE t.account_id = bs.account_id
              AND t.transaction_type = 'debit'
              AND t.transaction_date >= bs.statement_date_from
              AND t.transaction_date <= bs.statement_date_to
            GROUP BY category
          ) sub
        ) as debit_breakdown
      FROM bank_statements bs
      JOIN financial_accounts fa ON fa.id = bs.account_id
      WHERE bs.statement_date_from IS NOT NULL AND bs.statement_date_to IS NOT NULL
      ORDER BY bs.account_id, bs.statement_date_to DESC
    `)
    statementSummaries = rows
  } catch (error) {
    console.error('Error fetching statement summaries:', error)
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
        statementSummaries={statementSummaries}
      />
    </MainLayout>
  )
}
