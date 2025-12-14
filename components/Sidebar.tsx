"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconCirclePlusFilled, IconChevronRight, IconDashboard, IconUsers, IconCash, IconCalendarEvent, IconSettings, IconFileText, IconSend, IconMenu2, IconX } from '@tabler/icons-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { NavUser } from '@/components/nav-user'
import { useI18n } from '@/components/I18nProvider'
import GlobalSearch from '@/components/GlobalSearch'

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
  const [open, setOpen] = useState<Record<string, boolean>>({})
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

  // Define navigation items based on role
  const NAV_ITEMS = isAdminOrBoard ? [
    { title: t("dashboard"), url: "/dashboard", icon: IconDashboard },
    { title: t("members"), url: "/members", icon: IconUsers },
    { title: t("finance"), url: "/finance", icon: IconCash },
    { 
      title: t("events"), 
      url: "/events", 
      icon: IconCalendarEvent,
      children: [
        { title: t("meetings"), url: '/meetings' },
        { title: t("events"), url: '/events' },
      ]
    },
    { title: "Documents", url: "/documents", icon: IconFileText },
    { title: "Messaging", url: "/messaging", icon: IconSend },
  ] : [
    // Regular members only see limited items
    { title: t("dashboard"), url: "/dashboard", icon: IconDashboard },
    { title: t("members"), url: "/members", icon: IconUsers },
    { title: "Payments", url: "/payments", icon: IconCash },
    { 
      title: t("events"), 
      url: "/events", 
      icon: IconCalendarEvent,
      children: [
        { title: t("meetings"), url: '/meetings' },
        { title: t("events"), url: '/events' },
      ]
    },
    { title: "Documents", url: "/documents", icon: IconFileText },
  ]

  // Collapsed sidebar (mobile closed state)
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
        <div className="p-4 flex items-center justify-between">
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

        {/* Navigation */}
        <nav className="flex-1 px-2 md:px-4 py-2 overflow-y-auto">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const hasChildren = !!item.children?.length
              const childActive = !!item.children?.some((c) => {
                // Check exact match or if pathname starts with the child URL
                if (pathname === c.url || pathname.startsWith(c.url + '/')) return true
                // Special case: highlight Meetings for /meetings/create
                if (c.url === '/meetings' && pathname.startsWith('/meetings')) return true
                // Special case: highlight Events for /events/create
                if (c.url === '/events' && pathname.startsWith('/events') && !pathname.startsWith('/meetings')) return true
                return false
              })
              const itemActive = pathname === item.url || (pathname.startsWith(item.url + '/') && !hasChildren)
              const isOpen = open[item.title] ?? (hasChildren && childActive)

              return (
                <li key={item.title}>
                  {hasChildren ? (
                    <>
                      <button
                        onClick={() => {
                          if (!showText) {
                            // On mobile collapsed, navigate to first child
                            window.location.href = item.children![0].url
                          } else {
                            setOpen({ ...open, [item.title]: !isOpen })
                          }
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors ${!showText ? 'justify-center' : ''}`}
                        title={!showText ? item.title : undefined}
                      >
                        {item.icon && <item.icon className="size-5" />}
                        {showText && (
                          <>
                            <span className="flex-1 text-left">{item.title}</span>
                            <IconChevronRight className={`size-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                          </>
                        )}
                      </button>
                      {showText && isOpen && (
                        <ul className="mt-1 ml-6 space-y-1">
                          {item.children!.map((child) => (
                            <li key={child.url}>
                              <Link
                                href={child.url}
                                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                                  pathname === child.url
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                }`}
                                prefetch={true}
                              >
                                {child.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
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
                      {item.icon && <item.icon className="size-5" />}
                      {showText && <span>{item.title}</span>}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User - always visible with proper spacing */}
        <div className={`p-2 md:p-4 border-t border-sidebar-border ${!showText ? 'flex justify-center' : ''}`}>
          {showText ? (
            <NavUser user={{ 
              name: user?.name || "User", 
              email: user?.email || null, 
              avatar: user?.image || "" 
            }} />
          ) : (
            <Link
              href="/settings"
              className="p-2 rounded-md hover:bg-sidebar-accent transition-colors"
              title="Settings"
            >
              <IconSettings className="size-5" />
            </Link>
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
      <main className="flex-1 ml-16 md:ml-64 bg-background pt-0 transition-all duration-300">
        {children}
      </main>
    </div>
  )
}
