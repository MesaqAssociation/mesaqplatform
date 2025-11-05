import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import LanguageSelect from './LanguageSelect'

export default async function SettingsPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  
  const user = await getUserFromToken()
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  
  const user = await getUserFromToken()
  }
  return (
    <MainLayout user={user}>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="max-w-sm">
          <label className="block text-sm font-medium mb-2">Language</label>
          <LanguageSelect />
        </div>
      </div>
    </MainLayout>
  )
}


