import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import MessagingClient from './MessagingClient'

export default async function MessagingPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()

  // Only admins/board can access messaging
  const isAdmin = user && ['admin', 'board', 'Manager'].includes(user.role)
  if (!isAdmin) {
    redirect('/dashboard')
  }

  return (
    <MainLayout user={user}>
      <div className="p-6">
        <MessagingClient />
      </div>
    </MainLayout>
  )
}

