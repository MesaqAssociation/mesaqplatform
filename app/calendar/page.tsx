import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import CalendarClient from './CalendarClient'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()
  
  // Determine if user is admin/board
  const userRole = (user?.role || '').toLowerCase()
  const isAdminOrBoard = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer'].includes(userRole)

  return (
    <MainLayout user={user}>
      <CalendarClient isAdmin={isAdminOrBoard} />
    </MainLayout>
  )
}
