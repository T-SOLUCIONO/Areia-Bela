import {
  BarChart3,
  Calendar,
  ClipboardList,
  DollarSign,
  Globe,
  LayoutDashboard,
  Settings,
  Ticket,
  Users,
  Wrench,
} from 'lucide-react'
import type { UserRole } from '@areia-bela/types'
import type { AdminCopy } from '@/lib/admin-i18n'

/**
 * One source of truth for the admin routes, shared by the sidebar, the mobile
 * menu and the page header. `key` indexes the dictionary rather than holding a
 * label, so nothing here needs translating twice.
 *
 * `roles` omitted means every signed-in role sees it. Hiding a link is only a
 * convenience — the API enforces the same rules on every request.
 */
export interface AdminNavItem {
  key: keyof AdminCopy['nav']
  href: string
  icon: typeof LayoutDashboard
  roles?: UserRole[]
}

export const adminNavigation: AdminNavItem[] = [
  { key: 'dashboard', href: '/admin', icon: LayoutDashboard },
  { key: 'reservations', href: '/admin/reservations', icon: ClipboardList },
  { key: 'calendar', href: '/admin/calendar', icon: Calendar },
  { key: 'guests', href: '/admin/guests', icon: Users },
  { key: 'pricing', href: '/admin/pricing', icon: DollarSign, roles: ['superadmin', 'manager'] },
  { key: 'coupons', href: '/admin/coupons', icon: Ticket, roles: ['superadmin', 'manager'] },
  { key: 'maintenance', href: '/admin/maintenance', icon: Wrench },
  { key: 'reports', href: '/admin/reports', icon: BarChart3, roles: ['superadmin', 'manager'] },
  { key: 'content', href: '/admin/content', icon: Globe, roles: ['superadmin', 'manager'] },
  { key: 'settings', href: '/admin/settings', icon: Settings },
]

export function visibleNavigation(role: UserRole): AdminNavItem[] {
  return adminNavigation.filter((item) => !item.roles || item.roles.includes(role))
}

/** Longest matching href wins, so `/admin/calendar` doesn't resolve to `/admin`. */
export function activeNavItem(pathname: string): AdminNavItem | undefined {
  return adminNavigation
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
}
