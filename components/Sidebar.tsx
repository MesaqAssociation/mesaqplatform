"use client"

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconCirclePlusFilled, IconChevronRight, IconDashboard, IconUsers, IconCash, IconCalendarEvent, IconSettings } from '@tabler/icons-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { NavUser } from '@/components/nav-user'

const NAV_ITEMS = [
  { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
  { title: "Members", url: "/members", icon: IconUsers },
  { title: "Finance", url: "/finance", icon: IconCash },
  { 
    title: "Events", 
    url: "/events", 
    icon: IconCalendarEvent,
    children: [
      { title: 'Meetings', url: '/events/meetings' },
      { title: 'Events', url: '/events' },
    ]
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState<Record<string, boolean>>({})

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-4">
        <Link href="/dashboard" className="flex items-center">
          <img src="/crop-logo.webp" alt="Mesaq" width="48" height="48" className="object-contain" />
        </Link>
      </div>

      {/* Quick Create */}
      <div className="px-4 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <IconCirclePlusFilled className="size-4" />
              <span>Quick Create</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuItem asChild>
              <Link href="#">Bank Statement</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="#">Event</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="#">Meeting</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 overflow-y-auto">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const hasChildren = !!item.children?.length
            const childActive = !!item.children?.some((c) => pathname === c.url || pathname.startsWith(c.url))
            const itemActive = pathname === item.url
            const isOpen = open[item.title] ?? (hasChildren && childActive)

            return (
              <li key={item.title}>
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => setOpen({ ...open, [item.title]: !isOpen })}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    >
                      {item.icon && <item.icon className="size-4" />}
                      <span className="flex-1 text-left">{item.title}</span>
                      <IconChevronRight className={`size-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isOpen && (
                      <ul className="mt-1 ml-6 space-y-1">
                        {item.children!.map((child) => (
                          <li key={child.url}>
                            <Link
                              href={child.url}
                              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                pathname === child.url
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                              }`}
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      itemActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    {item.icon && <item.icon className="size-4" />}
                    <span>{item.title}</span>
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Search */}
      <div className="px-4 pb-2">
        <input
          type="search"
          placeholder="Search..."
          className="w-full h-8 px-3 text-sm bg-background border border-sidebar-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* User */}
      <div className="p-4 border-t border-sidebar-border">
        <NavUser user={{ name: "User", email: "user@example.com", avatar: "/placeholder-user.jpg" }} />
      </div>
    </aside>
  )
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 bg-background">
        {children}
      </main>
    </div>
  )
}

