import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import MonthlyFeeSettings from './MonthlyFeeSettings'
import FineSettings from './FineSettings'
import UserSettings from './UserSettings'
import ExportData from './ExportData'
import { Pool } from 'pg'

export default async function SettingsPage() {
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

  // Get current settings and full user data
  const pool = new (require('pg').Pool)({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  }) as Pool

  let currentFee = '50.00'
  let finesEnabled = false
  let fineAmount = '10.00'
  let fullUserData: any = {}
  
  try {
    // Get system settings
    const { rows: settingsRows } = await pool.query(`
      SELECT key, value FROM system_settings 
      WHERE key IN ('monthly_membership_fee', 'late_payment_fines_enabled', 'late_payment_fine_amount')
    `)
    
    settingsRows.forEach(row => {
      if (row.key === 'monthly_membership_fee') {
        currentFee = row.value
      } else if (row.key === 'late_payment_fines_enabled') {
        finesEnabled = row.value === 'true'
      } else if (row.key === 'late_payment_fine_amount') {
        fineAmount = row.value
      }
    })

    // Get full user data
    const { rows: userRows } = await pool.query(`
      SELECT 
        id, member_id, name, email, phone, address, 
        household_members, joined_date, created_at, role
      FROM users 
      WHERE id = $1
    `, [userId])
    
    if (userRows.length > 0) {
      fullUserData = userRows[0]
      console.log('✅ Loaded user data for:', fullUserData.name)
    } else {
      console.error('❌ No user found with id:', userId)
    }
  } catch (error) {
    console.error('Error fetching settings:', error)
  } finally {
    await pool.end()
  }
  
  return (
    <MainLayout user={user}>
      <SettingsClient 
        user={user} 
        fullUserData={fullUserData}
        currentFee={currentFee}
        finesEnabled={finesEnabled}
        fineAmount={fineAmount}
      />
    </MainLayout>
  )
}

function SettingsClient({ 
  user, 
  fullUserData,
  currentFee,
  finesEnabled,
  fineAmount
}: { 
  user: any
  fullUserData: any
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
        {/* User Profile Settings - Editable */}
        {fullUserData && fullUserData.id ? (
          <UserSettings user={fullUserData} />
        ) : (
          <div className="border rounded-lg p-6">
            <p className="text-sm text-muted-foreground">Unable to load user profile. Please try refreshing the page.</p>
          </div>
        )}

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

            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-medium mb-4">Export Data</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Export member, event, or finance data to CSV or Excel format
              </p>
              <ExportData />
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


