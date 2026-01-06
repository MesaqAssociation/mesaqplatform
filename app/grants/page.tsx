import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { redirect } from 'next/navigation'
import { Pool } from 'pg'
import { GrantsClient } from './GrantsClient'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

export default async function GrantsPage() {
  const token = cookies().get('auth_token')?.value
  
  if (!token || !process.env.AUTH_SECRET) {
    redirect('/')
  }
  
  let decoded: any
  try {
    decoded = jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const userId = decoded.userId || decoded.sub
  
  // Check if user is manager/admin
  const { rows: userRows } = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  )
  
  if (userRows.length === 0) {
    redirect('/dashboard')
  }
  
  const userRole = (userRows[0].role || '').toLowerCase()
  const allowedRoles = ['admin', 'manager', 'head', 'board']
  
  if (!allowedRoles.includes(userRole)) {
    redirect('/dashboard')
  }
  
  return <GrantsClient />
}

