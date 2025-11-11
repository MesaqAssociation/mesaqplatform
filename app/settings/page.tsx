import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import MonthlyFeeSettings from './MonthlyFeeSettings'
import FineSettings from './FineSettings'
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

  // Get current settings
  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool

  let currentFee = '50.00'
  let finesEnabled = false
  let fineAmount = '10.00'
  
  try {
    const { rows } = await pool.query(`
      SELECT key, value FROM system_settings 
      WHERE key IN ('monthly_membership_fee', 'late_payment_fines_enabled', 'late_payment_fine_amount')
    `)
    
    rows.forEach(row => {
      if (row.key === 'monthly_membership_fee') {
        currentFee = row.value
      } else if (row.key === 'late_payment_fines_enabled') {
        finesEnabled = row.value === 'true'
      } else if (row.key === 'late_payment_fine_amount') {
        fineAmount = row.value
      }
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
  }
  
  return (
    <MainLayout user={user}>
      <SettingsClient 
        user={user} 
        currentFee={currentFee}
        finesEnabled={finesEnabled}
        fineAmount={fineAmount}
      />
    </MainLayout>
  )
}

function SettingsClient({ 
  user, 
  currentFee,
  finesEnabled,
  fineAmount
}: { 
  user: any
  currentFee: string
  finesEnabled: boolean
  fineAmount: string
}) {
  const isBoard = user?.role === 'board'

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      
      <div className="max-w-2xl space-y-6">
        {/* Monthly Fee Settings - Only for Board */}
        {isBoard && (
          <div className="border rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Membership Fee</h2>
            <MonthlyFeeSettings initialFee={currentFee} />
          </div>
        )}

        {/* Fine Settings - Only for Board */}
        {isBoard && (
          <div className="border rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Late Payment Fines</h2>
            <FineSettings 
              initialEnabled={finesEnabled}
              initialAmount={fineAmount}
            />
          </div>
        )}
      </div>
    </div>
  )
}


