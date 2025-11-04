import type React from "react"
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/')
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <div className="flex flex-1 items-center justify-center">
          <h1 className="text-6xl font-bold text-gray-400">404</h1>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
