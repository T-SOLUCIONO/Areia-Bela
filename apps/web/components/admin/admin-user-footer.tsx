'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { ADMIN_LOGIN_PATH } from '@areia-bela/shared'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useAdminSession } from '@/components/admin/admin-session-provider'

const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Superadmin',
  manager: 'Manager',
  viewer: 'Viewer',
}

/**
 * Shared by the sidebar and the mobile header, which previously each had their
 * own copy of a fake "Exit Admin" link pointing at the public site.
 */
export function AdminUserFooter({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const session = useAdminSession()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const signOut = async () => {
    setIsSigningOut(true)
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch {
      // Even if revoking server-side fails, still leave the panel — the cookie
      // is cleared by the response, and staying put would be worse.
    } finally {
      onNavigate?.()
      // Full navigation so the server-side layout re-evaluates the session.
      window.location.assign(ADMIN_LOGIN_PATH)
    }
  }

  const initials = `${session.firstName.charAt(0)}${session.lastName.charAt(0)}`.toUpperCase()

  return (
    <div className={cn('space-y-3', collapsed && 'space-y-2')}>
      <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {session.firstName} {session.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {ROLE_LABEL[session.role] ?? session.role}
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={signOut}
        disabled={isSigningOut}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50',
          collapsed && 'justify-center',
        )}
      >
        <LogOut className="h-5 w-5 shrink-0" />
        {!collapsed && <span>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>}
      </button>
    </div>
  )
}
