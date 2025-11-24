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
  // Allow board members and admin roles to access settings
  const isAdmin = user?.role === 'board' || user?.role === 'admin' || user?.role === 'Manager'

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      
      <div className="max-w-2xl space-y-6">
        {/* User Profile Settings */}
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <p className="text-sm">{user?.name || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-sm">{user?.email || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Phone</label>
              <p className="text-sm">{user?.phone || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <p className="text-sm">{user?.role || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Admin Settings - Only for Board/Admin */}
        {isAdmin && (
          <>
            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Membership Fee</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Set the monthly membership fee for all members
              </p>
              <MonthlyFeeSettings initialFee={currentFee} />
            </div>

            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Late Payment Fines</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure automatic fines for late payments
              </p>
              <FineSettings 
                initialEnabled={finesEnabled}
                initialAmount={fineAmount}
              />
            </div>
          </>
        )}

        {!isAdmin && (
          <div className="border rounded-lg p-6 bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Additional settings are only available to administrators and board members.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}


