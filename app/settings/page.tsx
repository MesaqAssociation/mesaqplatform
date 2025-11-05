import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import LanguageSelect from './LanguageSelect'
import MonthlyFeeSettings from './MonthlyFeeSettings'
import { Pool } from 'pg'

export default async function SettingsPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()

  // Get current monthly fee
  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool

  let currentFee = '50.00'
  try {
    const { rows } = await pool.query(`
      SELECT value FROM system_settings WHERE key = 'monthly_membership_fee'
    `)
    if (rows[0]) {
      currentFee = rows[0].value
    }
  } catch (error) {
    console.error('Error fetching monthly fee:', error)
  }
  
  return (
    <MainLayout user={user}>
      <SettingsClient user={user} currentFee={currentFee} />
    </MainLayout>
  )
}

function SettingsClient({ user, currentFee }: { user: any, currentFee: string }) {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      
      <div className="max-w-2xl space-y-6">
        {/* Language Settings */}
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Language</h2>
          <LanguageSelect />
        </div>

        {/* Monthly Fee Settings - Only for Head Board Member */}
        {user?.role === 'Head Board Member' && (
          <div className="border rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Membership Fee</h2>
            <MonthlyFeeSettings initialFee={currentFee} />
          </div>
        )}
      </div>
    </div>
  )
}


