'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Users,
  ClipboardList,
  DollarSign,
  Ticket,
  BarChart3,
  Settings,
  Wrench,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { UserRole } from '@areia-bela/types'
import { cn } from '@/lib/utils'
import { Button } from '@areia-bela/ui/button'
import { Separator } from '@areia-bela/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@areia-bela/ui/tooltip'
import { AdminUserFooter } from '@/components/admin/admin-user-footer'
import { useAdminSession } from '@/components/admin/admin-session-provider'

/**
 * `roles` omitted means every signed-in role may see the item. Hiding a link is
 * only a convenience — the API enforces the same rules on every request.
 */
export const adminNavigation: Array<{
  name: string
  href: string
  icon: typeof LayoutDashboard
  roles?: UserRole[]
}> = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Reservations', href: '/admin/reservations', icon: ClipboardList },
  { name: 'Calendar', href: '/admin/calendar', icon: Calendar },
  { name: 'Guests', href: '/admin/guests', icon: Users },
  { name: 'Pricing', href: '/admin/pricing', icon: DollarSign, roles: ['superadmin', 'manager'] },
  { name: 'Coupons', href: '/admin/coupons', icon: Ticket, roles: ['superadmin', 'manager'] },
  { name: 'Maintenance', href: '/admin/maintenance', icon: Wrench },
  { name: 'Reports', href: '/admin/reports', icon: BarChart3, roles: ['superadmin', 'manager'] },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
]

export function visibleNavigation(role: UserRole) {
  return adminNavigation.filter((item) => !item.roles || item.roles.includes(role))
}

export function AdminSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { role } = useAdminSession()
  const navigation = visibleNavigation(role)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 hidden md:flex flex-col',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div className="flex h-full flex-col w-full">
          {/* Logo */}
          <div
            className={cn(
              'flex h-16 items-center border-b border-sidebar-border px-4',
              collapsed ? 'justify-center' : 'justify-between',
            )}
          >
            {!collapsed && (
              <Link href="/admin" className="flex flex-col">
                <span className="font-serif text-lg font-semibold text-sidebar-foreground">
                  Areia Bela
                </span>
                <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                  Admin Portal
                </span>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-2">
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href))

                const link = (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      collapsed && 'justify-center',
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                )

                return (
                  <li key={item.name}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.name}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border p-4">
            <AdminUserFooter collapsed={collapsed} />
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
