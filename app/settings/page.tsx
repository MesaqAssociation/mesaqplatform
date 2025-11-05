import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import LanguageSelect from './LanguageSelect'

export default async function SettingsPage() {
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
      <SettingsClient />
    </MainLayout>
  )
}

function SettingsClient() {
  return (
    <div className="p-6 space-y-4">
      <div className="max-w-sm">
        <LanguageSelect />
      </div>
    </div>
  )
}


