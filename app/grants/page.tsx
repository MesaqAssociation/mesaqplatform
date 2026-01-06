import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { redirect } from 'next/navigation'
import { Pool } from 'pg'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
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
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()
  
  // Check if user is manager/admin/board
  const userRole = (user?.role || '').toLowerCase()
  const allowedRoles = ['admin', 'manager', 'head', 'board', 'finance officer', 'logistics officer', 'public officer']
  
  if (!allowedRoles.includes(userRole)) {
    redirect('/dashboard')
  }
  
  return (
    <MainLayout user={user}>
      <div className="p-6">
        <GrantsClient />
      </div>
    </MainLayout>
  )
}

