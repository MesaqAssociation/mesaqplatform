import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import UnknownTransactionsClient from './UnknownTransactionsClient'

export default async function UnknownTransactionsPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) {
    redirect('/')
  }
  
  let userRole: string = 'member'
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch (err) {
    console.error('Auth error:', err)
    redirect('/')
  }

  const user = await getUserFromToken()
  userRole = (user?.role || 'member').toLowerCase()

  // Only admins, board, and managers can access this page
  const allowedRoles = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer']
  if (!allowedRoles.includes(userRole)) {
    redirect('/access-denied')
  }

  return (
    <MainLayout user={user}>
      <UnknownTransactionsClient />
    </MainLayout>
  )
}

