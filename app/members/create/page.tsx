import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import Link from 'next/link'
import { MainLayout } from '@/components/Sidebar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import CreateMemberForm from './CreateMemberForm'
import { IconArrowLeft } from '@tabler/icons-react'

export default async function CreateMemberPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  return (
    <MainLayout>
      <div className="p-6 max-w-3xl">
        <Link href="/members">
          <Button variant="ghost" className="mb-4">
            <IconArrowLeft className="mr-2 size-4" />
            Members
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold mb-2">Create New Member</h1>
        <p className="text-muted-foreground mb-6">Add a new member to the system</p>
        <Separator className="mb-6" />
        <CreateMemberForm />
      </div>
    </MainLayout>
  )
}
