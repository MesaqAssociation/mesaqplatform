"use client"

import * as React from "react"
import {
  IconDashboard,
  IconUsers,
  IconCash,
  IconCalendarEvent,
  IconSettings,
  IconSearch,
  IconInnerShadowTop,
} from "@tabler/icons-react"

import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
    { title: "Members", url: "/members", icon: IconUsers },
    { title: "Finance", url: "/finance", icon: IconCash },
    { title: "Events", url: "/events", icon: IconCalendarEvent, children: [
      { title: 'Meetings', url: '/events/meetings' },
      { title: 'Events', url: '/events' },
    ] },
  ],
  navSecondary: [],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5 hover:bg-transparent hover:text-inherit"
            >
              <a href="/dashboard" className="flex items-center">
                <img src="/crop-logo.webp" alt="Mesaq" width="48" height="48" />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-2">
          <input
            placeholder="Search..."
            className="h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-md border px-2 text-sm"
          />
        </div>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
