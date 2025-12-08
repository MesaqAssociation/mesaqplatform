import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import ReviewPaymentsClient from './ReviewPaymentsClient'

export default async function ReviewPaymentsPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    redirect('/')
  }
  
  let user: any
  let userRole: string = 'member'
  
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    const userId = decoded.userId || decoded.sub
    
    if (!userId) {
      redirect('/')
    }
    
    // Get user role from database
    const { Pool } = require('pg')
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
    
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId])
    if (rows.length > 0) {
      userRole = (rows[0].role || 'member').toLowerCase()
    }
    
    user = { id: userId, role: userRole }
  } catch (err) {
    console.error('Auth error:', err)
    redirect('/')
  }

  // Only admins, board, and managers can access this page
  const allowedRoles = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer']
  if (!allowedRoles.includes(userRole)) {
    redirect('/access-denied')
  }

  return (
    <MainLayout user={user}>
      <ReviewPaymentsClient />
    </MainLayout>
  )
}

