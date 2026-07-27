import { cookies } from 'next/headers'
import { ACCESS_TOKEN_COOKIE } from '@areia-bela/shared'
import type { UserRole } from '@areia-bela/types'
import { API_URL } from '@/lib/api-client'

export interface AdminSession {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  totpEnabled: boolean
  recoveryCodesRemaining: number
}

interface MeResponse {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: 'SUPERADMIN' | 'MANAGER' | 'VIEWER'
    totpEnabled: boolean
    recoveryCodesRemaining: number
  }
}

/** Prisma stores roles SCREAMING_SNAKE; the domain type is lowercase. */
const toDomainRole = (role: MeResponse['user']['role']): UserRole => role.toLowerCase() as UserRole

/**
 * Server-side session check — the layer that actually verifies the session,
 * since the middleware only looks for the cookie's presence. Returns null
 * rather than throwing so layouts can redirect.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value
  if (!accessToken) return null

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}` },
      // Never cached: a deactivated account must lose access immediately.
      cache: 'no-store',
    })
    if (!response.ok) return null

    const { user } = (await response.json()) as MeResponse
    return { ...user, role: toDomainRole(user.role) }
  } catch {
    // API unreachable — treat as unauthenticated rather than letting the admin
    // panel render with no session.
    return null
  }
}
