'use client'

import { Bell, Search, User, ExternalLink, Menu } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@areia-bela/ui/dropdown-menu'
import { Badge } from '@areia-bela/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from '@areia-bela/ui/sheet'
import { ADMIN_LOGIN_PATH } from '@areia-bela/shared'
import { cn } from '@/lib/utils'
import { visibleNavigation } from '@/components/admin/admin-sidebar'
import { AdminUserFooter } from '@/components/admin/admin-user-footer'
import { useAdminSession } from '@/components/admin/admin-session-provider'
import { apiFetch } from '@/lib/api-client'

interface AdminHeaderProps {
  title: string
  description?: string
}

export function AdminHeader({ title, description }: AdminHeaderProps) {
  const pathname = usePathname()
  const session = useAdminSession()
  const navigation = visibleNavigation(session.role)

  const signOut = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } finally {
      window.location.assign(ADMIN_LOGIN_PATH)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex items-center gap-4">
        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[280px] p-0 border-r border-sidebar-border bg-sidebar flex flex-col"
          >
            <SheetTitle className="sr-only">Admin Sidebar Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Menu links for the admin dashboard
            </SheetDescription>
            <div className="flex flex-col h-full bg-sidebar">
              {/* Logo */}
              <div className="flex h-16 items-center border-b border-sidebar-border px-4">
                <Link href="/admin" className="flex flex-col">
                  <span className="font-serif text-lg font-semibold text-sidebar-foreground">
                    Areia Bela
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                    Admin Portal
                  </span>
                </Link>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1 px-2">
                  {navigation.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/admin' && pathname.startsWith(item.href))

                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          )}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <span>{item.name}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>

              {/* Footer */}
              <div className="border-t border-sidebar-border p-4">
                <AdminUserFooter />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground hidden sm:block">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder="Search..." className="w-64 pl-9" />
        </div>

        {/* View Website */}
        <Link href="/" target="_blank">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Site
          </Button>
        </Link>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">New reservation</span>
              <span className="text-sm text-muted-foreground">
                Emily Johnson booked Luxury Suite for Mar 15-20
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Check-in today</span>
              <span className="text-sm text-muted-foreground">
                Michael Chen - Deluxe Room (Room 201)
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
              <span className="font-medium">Housekeeping alert</span>
              <span className="text-sm text-muted-foreground">
                Room 102 marked as dirty - needs cleaning
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-primary">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">
                  {session.firstName} {session.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{session.email}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">{session.role}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/settings">Security &amp; 2FA</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
