import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { Pool } from 'pg'
import FinanceClient from './FinanceClient'
import { getUserFromToken } from '@/lib/getUserFromToken'

// Force dynamic rendering to avoid hydration issues
export const dynamic = 'force-dynamic'

export default async function FinancePage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()

  // Restrict finance page to admins/board only
  const isAdmin = user?.role === 'board' || user?.role === 'admin' || user?.role === 'Manager'
  if (!isAdmin) {
    redirect('/dashboard') // Redirect regular members to dashboard
  }

  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool

  // Get all accounts
  const { rows: accounts } = await pool.query(`
    SELECT 
      id,
      account_name,
      account_number,
      bsb,
      current_balance,
      currency,
      created_at
    FROM financial_accounts 
    ORDER BY created_at ASC
  `)

  // If no accounts exist, create a default one
  if (accounts.length === 0) {
    const { rows: newAccount } = await pool.query(`
      INSERT INTO financial_accounts (account_name, current_balance)
      VALUES ('Main Account', 0.00)
      RETURNING id, account_name, account_number, current_balance, currency, created_at
    `)
    accounts.push(newAccount[0])
  }

  const firstAccount = accounts[0]

  // Get current month transactions for first account
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  
  const { rows: transactions } = await pool.query(`
    SELECT 
      t.id,
      t.account_id,
      to_char(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
      t.transaction_name,
      t.description,
      t.category,
      t.amount,
      t.transaction_type,
      t.reference,
      t.balance_after,
      t.created_by,
      t.source,
      t.created_at,
      u.name as creator_name 
    FROM transactions t 
    LEFT JOIN users u ON t.created_by = u.id 
    WHERE t.account_id = $1 
      AND EXTRACT(YEAR FROM t.transaction_date) = $2
      AND EXTRACT(MONTH FROM t.transaction_date) = $3
    ORDER BY t.transaction_date DESC, t.created_at DESC
  `, [firstAccount.id, year, month])

  return (
    <MainLayout user={user}>
      <div className="p-6">
        <FinanceClient 
          account={firstAccount} 
          initialTransactions={transactions}
          allAccounts={accounts}
        />
      </div>
    </MainLayout>
  )
}


