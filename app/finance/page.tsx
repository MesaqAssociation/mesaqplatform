import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { Pool } from 'pg'
import FinanceClient from './FinanceClient'
import { getUserFromToken } from '@/lib/getUserFromToken'

export default async function FinancePage() {
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

  // Get main account
  const { rows: accounts } = await pool.query('SELECT * FROM financial_accounts LIMIT 1')
  const account = accounts[0] || { id: null, current_balance: 0 }

  // Get recent transactions with explicit date formatting
  const { rows: transactions } = await pool.query(`
    SELECT 
      t.id,
      t.account_id,
      to_char(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
      t.transaction_name,
      t.description,
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
    WHERE t.account_id = $1 OR t.account_id IS NULL
    ORDER BY t.transaction_date DESC, t.created_at DESC 
    LIMIT 200
  `, [account.id])

  return (
    <MainLayout user={user}>
      <div className="p-6">
        <FinanceClient account={account} initialTransactions={transactions} />
      </div>
    </MainLayout>
  )
}


