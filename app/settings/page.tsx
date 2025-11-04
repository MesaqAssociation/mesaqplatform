import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <div className="max-w-sm">
            <label className="block text-sm font-medium mb-2">Language</label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">🇺🇸 English</SelectItem>
                <SelectItem value="ar">🇸🇦 Arabic</SelectItem>
                <SelectItem value="fa">🇮🇷 Persian</SelectItem>
                <SelectItem value="fr">🇫🇷 French</SelectItem>
                <SelectItem value="de">🇩🇪 German</SelectItem>
                <SelectItem value="es">🇪🇸 Spanish</SelectItem>
                <SelectItem value="hi">🇮🇳 Hindi</SelectItem>
                <SelectItem value="zh">🇨🇳 Chinese</SelectItem>
                <SelectItem value="ja">🇯🇵 Japanese</SelectItem>
                <SelectItem value="ru">🇷🇺 Russian</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}


