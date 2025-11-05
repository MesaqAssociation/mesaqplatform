"use client"

import { IconCirclePlusFilled, IconChevronRight, type Icon } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    children?: { title: string; url: string }[]
  }[]
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  tooltip="Quick Create"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
                >
                  <IconCirclePlusFilled className="size-4" />
                  <span>Quick Create</span>
                </SidebarMenuButton>
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
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            const hasChildren = !!item.children?.length
            const childActive = !!item.children?.some((c) => pathname === c.url || pathname.startsWith(c.url))
            const itemActive = pathname === item.url || pathname.startsWith(item.url)
            const isActive = itemActive
            const isOpen = open[item.title] ?? (hasChildren && (childActive || itemActive))
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  asChild={!hasChildren}
                  isActive={isActive}
                  onClick={() => hasChildren && setOpen({ ...open, [item.title]: !isOpen })}
                >
                  {hasChildren ? (
                    <div className="flex w-full items-center cursor-pointer gap-2">
                      {item.icon && <item.icon className="size-4" />}
                      <span className="flex-1">{item.title}</span>
                      <IconChevronRight className={`size-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </div>
                  ) : (
                    <Link href={item.url}>
                      {item.icon && <item.icon className="size-4" />}
                      <span>{item.title}</span>
                    </Link>
                  )}
                </SidebarMenuButton>
                {hasChildren && isOpen ? (
                  <ul data-sidebar="menu-sub" className="mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 px-2.5 py-0.5">
                    {item.children!.map((child) => {
                      const childActive = pathname === child.url
                      return (
                        <li key={child.title}>
                          <a
                            data-sidebar="menu-sub-button"
                            className="flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground [&>span:last-child]:truncate"
                            data-active={childActive}
                            href={child.url}
                          >
                            <span>{child.title}</span>
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
