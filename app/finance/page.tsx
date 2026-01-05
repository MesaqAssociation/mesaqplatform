import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { Pool } from 'pg'
import FinanceClient from './FinanceClient'
import LandscapeCheck from './LandscapeCheck'
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
  const userRole = (user?.role || '').toLowerCase()
  const isAdminOrBoard = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer'].includes(userRole)
  if (!isAdminOrBoard) {
    redirect('/access-denied')
  }

  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool

  // Get all accounts including main membership and donation flags
  const { rows: accounts } = await pool.query(`
    SELECT 
      id,
      account_name,
      account_number,
      bsb,
      current_balance,
      currency,
      COALESCE(is_donation_account, false) as is_donation_account,
      COALESCE(is_main_membership_account, false) as is_main_membership_account,
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

  // Get monthly fee for membership payment validation
  const { rows: feeRows } = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'"
  )
  const monthlyFee = parseFloat(feeRows[0]?.value || '40.00')

  return (
    <MainLayout user={user}>
      <LandscapeCheck>
      <div className="p-6">
        <FinanceClient 
          account={firstAccount} 
          allAccounts={accounts}
          monthlyFee={monthlyFee}
        />
      </div>
      </LandscapeCheck>
    </MainLayout>
  )
}


