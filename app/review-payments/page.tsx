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
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET) as any
    const userId = decoded.userId || decoded.sub
    
    if (!userId) {
      redirect('/')
    }
    
    user = { id: userId, role: decoded.role || 'member' }
  } catch {
    redirect('/')
  }

  // Only admins and board can access this page
  const userRole = (user.role || '').toLowerCase()
  if (!['admin', 'board', 'manager'].includes(userRole)) {
    redirect('/dashboard')
  }

  return (
    <MainLayout user={user}>
      <ReviewPaymentsClient />
    </MainLayout>
  )
}

