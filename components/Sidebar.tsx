"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconDashboard, IconUsers, IconCash, IconCalendarEvent, IconSettings, IconFileText, IconSend, IconMenu2, IconX, IconLogout, IconBell } from '@tabler/icons-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useI18n } from '@/components/I18nProvider'
import { getInitials } from '@/lib/utils'

type SidebarProps = {
  user?: {
    name: string
    email: string | null
    image: string | null
    role?: string
  } | null
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  
  // Mobile sidebar state - closed by default on mobile
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close sidebar on route change for mobile
  useEffect(() => {
    if (isMobile) {
      setIsMobileOpen(false)
    }
  }, [pathname, isMobile])

  // Determine if user is admin/board
  const userRole = (user?.role || '').toLowerCase()
  const isAdminOrBoard = ['admin', 'board', 'manager', 'head', 'finance officer', 'logistics officer', 'public officer'].includes(userRole)

  // Define navigation items based on role - with Calendar before Members
  const NAV_ITEMS = isAdminOrBoard ? [
    { title: t("dashboard"), url: "/dashboard", icon: IconDashboard },
    { title: "Calendar", url: "/calendar", icon: IconBell },
    { title: t("members"), url: "/members", icon: IconUsers },
    { title: t("finance"), url: "/finance", icon: IconCash },
    { title: t("events"), url: "/events", icon: IconCalendarEvent },
    { title: "Documents", url: "/documents", icon: IconFileText },
    { title: "Messaging", url: "/messaging", icon: IconSend },
  ] : [
    // Regular members only see limited items
    { title: t("dashboard"), url: "/dashboard", icon: IconDashboard },
    { title: "Calendar", url: "/calendar", icon: IconBell },
    { title: t("members"), url: "/members", icon: IconUsers },
    { title: "Payments", url: "/payments", icon: IconCash },
    { title: t("events"), url: "/events", icon: IconCalendarEvent },
    { title: "Documents", url: "/documents", icon: IconFileText },
  ]

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/'
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  // Sidebar width and text visibility
  const sidebarWidth = isMobile && !isMobileOpen ? 'w-16' : 'w-64'
  const showText = !isMobile || isMobileOpen

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      
      <aside className={`fixed left-0 top-0 z-40 h-screen ${sidebarWidth} bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300`}>
        {/* Header with Logo and Mobile Toggle */}
        <div className="p-4 flex items-center justify-between flex-shrink-0">
          <Link href="/dashboard" className="flex items-center">
            <img src="/crop-logo.webp" alt="Mesaq" width="48" height="48" className="object-contain" />
          </Link>
          {isMobile && (
            <button
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className="p-2 rounded-md hover:bg-sidebar-accent transition-colors"
            >
              {isMobileOpen ? <IconX className="size-5" /> : <IconMenu2 className="size-5" />}
            </button>
          )}
        </div>

        {/* Navigation - takes remaining space */}
        <nav className="flex-1 px-2 md:px-4 py-2 overflow-y-auto">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const itemActive = pathname === item.url || pathname.startsWith(item.url + '/')

              return (
                <li key={item.title}>
                  <Link
                    href={item.url}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${!showText ? 'justify-center' : ''} ${
                      itemActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                    prefetch={true}
                    title={!showText ? item.title : undefined}
                  >
                    {item.icon && <item.icon className="size-5 flex-shrink-0" />}
                    {showText && <span>{item.title}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User Section - Fixed at bottom */}
        <div className={`border-t border-sidebar-border flex-shrink-0 ${showText ? 'p-3' : 'p-2'}`}>
          {showText ? (
            // Expanded view (desktop or mobile expanded) - buttons open to the right
            <div className="space-y-2">
              {/* Settings button */}
              <Link
                href="/settings"
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full ${
                  pathname === '/settings'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
              >
                <IconSettings className="size-5" />
                <span>{t("settings")}</span>
              </Link>
              
              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <IconLogout className="size-5" />
                <span>{t("logout")}</span>
              </button>
              
              {/* User info */}
              <div className="flex items-center gap-2 px-3 py-2 border-t border-sidebar-border mt-2 pt-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.image || undefined} alt={user?.name || 'User'} />
                  <AvatarFallback>{getInitials(user?.name || 'U')}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium truncate flex-1">{user?.name || 'User'}</span>
              </div>
            </div>
          ) : (
            // Collapsed view (mobile only) - dropdown opens UPWARD
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex justify-center p-2 rounded-md hover:bg-sidebar-accent transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.image || undefined} alt={user?.name || 'User'} />
                    <AvatarFallback>{getInitials(user?.name || 'U')}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-48 mb-2">
                <div className="px-2 py-1.5 text-sm font-medium truncate">
                  {user?.name || 'User'}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <IconSettings className="mr-2 size-4" />
                    {t("settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <IconLogout className="mr-2 size-4" />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>
    </>
  )
}

export function MainLayout({ children, user }: { children: React.ReactNode; user?: { name: string; email: string | null; image: string | null; role?: string } | null }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      {/* Main content with responsive margin */}
      <main className="flex-1 ml-16 md:ml-64 bg-background transition-all duration-300">
        {children}
      </main>
    </div>
  )
}
