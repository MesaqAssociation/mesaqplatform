import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import MeetingsClientWrapper from './MeetingsClientWrapper'

export default async function MeetingsPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()

  return (
    <MainLayout user={{ ...user, role: user?.role }}>
      <MeetingsClientWrapper userRole={user?.role} />
    </MainLayout>
  )
}


