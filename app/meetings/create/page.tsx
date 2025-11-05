import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import CreateEventForm from '../../events/create/CreateEventForm'
import { IconArrowLeft } from '@tabler/icons-react'

export default async function CreateMeetingPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  
  const user = await getUserFromToken()
  
  return (
    <MainLayout user={user}>
      <div className="p-6 max-w-3xl">
        <Link href="/meetings">
          <Button variant="ghost" className="mb-4">
            <IconArrowLeft className="size-4 mr-2" />
            Meetings
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold mb-6">Create New Meeting</h1>
        <CreateEventForm defaultType="Meeting" />
      </div>
    </MainLayout>
  )
}

