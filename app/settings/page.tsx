import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import SettingsClient from './SettingsClient'
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
  }
  // Don't close the pool - it's shared across requests
  
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


