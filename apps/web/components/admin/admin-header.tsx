'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, Languages, Menu, User } from 'lucide-react'
import { ADMIN_LOGIN_PATH } from '@areia-bela/shared'
import { Button } from '@areia-bela/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@areia-bela/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@areia-bela/ui/sheet'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api-client'
import { AdminUserFooter } from '@/components/admin/admin-user-footer'
import { useAdminSession } from '@/components/admin/admin-session-provider'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { activeNavItem, visibleNavigation } from '@/components/admin/admin-navigation'

/**
 * Rendered once by the layout, so every page gets the mobile menu trigger.
 * The title comes from the route rather than a prop — six pages previously
 * rendered their own heading and skipped this bar entirely.
 */
export function AdminHeader() {
  const pathname = usePathname()
  const session = useAdminSession()
  const { language, setLanguage, t } = useAdminLanguage()
  const navigation = visibleNavigation(session.role)
  const current = activeNavItem(pathname)

  const signOut = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } finally {
      window.location.assign(ADMIN_LOGIN_PATH)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">{t.header.openMenu}</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex w-[280px] flex-col border-r border-sidebar-border bg-sidebar p-0"
          >
            <SheetTitle className="sr-only">{t.header.openMenu}</SheetTitle>
            <SheetDescription className="sr-only">{t.settings.title}</SheetDescription>

            <div className="flex h-16 items-center border-b border-sidebar-border px-4">
              <Link href="/admin" className="flex flex-col">
                <span className="font-serif text-lg text-sidebar-foreground">Areia Bela</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
                  {t.header.brandSubtitle}
                </span>
              </Link>
            </div>

            <nav className="flex-1 overflow-y-auto py-4">
              <ul className="space-y-1 px-2">
                {navigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/admin' && pathname.startsWith(item.href))
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span>{t.nav[item.key]}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div className="border-t border-sidebar-border p-4">
              <AdminUserFooter />
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0">
          <h1 className="truncate font-serif text-xl text-foreground">
            {current ? t.nav[current.key] : 'Areia Bela'}
          </h1>
          {current && (
            <p className="hidden truncate text-sm text-muted-foreground sm:block">
              {t.navDescription[current.key]}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Languages className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">{language}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setLanguage('es')}>Español</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setLanguage('en')}>English</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <Link href="/" target="_blank">
            <ExternalLink className="h-4 w-4" />
            {t.header.viewSite}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t.header.account}>
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">
                {session.firstName} {session.lastName}
              </p>
              <p className="truncate text-sm font-normal text-muted-foreground">{session.email}</p>
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                {t.roles[session.role]}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/settings">{t.header.security}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>{t.header.signOut}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
