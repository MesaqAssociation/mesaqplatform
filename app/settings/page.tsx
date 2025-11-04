import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import LanguageSelect from './LanguageSelect'

export default async function SettingsPage() {
  const token = cookies().get('auth_token')?.value
  if (!token || !process.env.AUTH_SECRET) redirect('/')
  try {
    jwt.verify(token, process.env.AUTH_SECRET)
  } catch {
    redirect('/')
  }
  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <div className="max-w-sm">
            <label className="block text-sm font-medium mb-2">Language</label>
            <LanguageSelect />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}


