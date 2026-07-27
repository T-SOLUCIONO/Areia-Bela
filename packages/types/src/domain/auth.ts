/**
 * Staff accounts for /admin. Distinct from Customer, which is a booking guest
 * and never signs in.
 *
 * Roles are a fixed set (docs/domain-decisions.md), not runtime-assignable
 * permissions — see the Prisma UserRole enum for the storage side. Values are
 * lowercase here to match the existing domain-type convention (BookingStatus).
 */
export type UserRole = 'superadmin' | 'manager' | 'viewer'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  active: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

/** The shape returned by GET /auth/me and held by the admin session. */
export interface SessionUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
}
