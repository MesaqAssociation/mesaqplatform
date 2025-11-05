import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import CreateMemberForm from './CreateMemberForm'

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
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Create New Member</h1>
        <CreateMemberForm />
      </div>
    </MainLayout>
  )
}

