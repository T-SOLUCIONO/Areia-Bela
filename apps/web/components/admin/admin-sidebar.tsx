'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@areia-bela/ui/tooltip'
import { cn } from '@/lib/utils'
import { AdminUserFooter } from '@/components/admin/admin-user-footer'
import { useAdminSession } from '@/components/admin/admin-session-provider'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { visibleNavigation } from '@/components/admin/admin-navigation'

export function AdminSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { role } = useAdminSession()
  const t = useAdminCopy()
  const navigation = visibleNavigation(role)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 md:flex',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div className="flex h-full w-full flex-col">
          <div
            className={cn(
              'flex h-16 items-center border-b border-sidebar-border px-4',
              collapsed ? 'justify-center' : 'justify-between',
            )}
          >
            {!collapsed && (
              <Link href="/admin" className="flex flex-col">
                <span className="font-serif text-lg text-sidebar-foreground">Areia Bela</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
                  {t.header.brandSubtitle}
                </span>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-2">
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href))

                const link = (
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      collapsed && 'justify-center',
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{t.nav[item.key]}</span>}
                  </Link>
                )

                return (
                  <li key={item.key}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{t.nav[item.key]}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <AdminUserFooter collapsed={collapsed} />
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
