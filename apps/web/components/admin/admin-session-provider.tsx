'use client'

import { createContext, useContext } from 'react'
import type { UserRole } from '@areia-bela/types'
import type { AdminSession } from '@/lib/admin-session'

const AdminSessionContext = createContext<AdminSession | null>(null)

/**
 * Carries the session verified server-side in the admin layout down to client
 * components, so nothing has to re-fetch /auth/me to know who is signed in.
 */
export function AdminSessionProvider({
  session,
  children,
}: {
  session: AdminSession
  children: React.ReactNode
}) {
  return <AdminSessionContext.Provider value={session}>{children}</AdminSessionContext.Provider>
}

export function useAdminSession(): AdminSession {
  const session = useContext(AdminSessionContext)
  if (!session) throw new Error('useAdminSession must be used within AdminSessionProvider')
  return session
}

/** Role checks used to hide UI. The API enforces the same rules server-side. */
export function useHasRole(...roles: UserRole[]): boolean {
  const { role } = useAdminSession()
  return roles.includes(role)
}
