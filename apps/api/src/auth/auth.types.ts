import type { UserRole } from '@prisma/client'

/** JWT payload for the access token. Deliberately minimal — no PII beyond email. */
export interface AccessTokenPayload {
  sub: string
  email: string
  role: UserRole
}

/** What JwtAuthGuard attaches to the request after verifying the token. */
export interface AuthenticatedUser {
  id: string
  email: string
  role: UserRole
}

/**
 * Marks the interim token issued between login step 1 and 2. The purpose claim
 * stops a challenge token from being accepted anywhere an access token is —
 * both are signed with the same key.
 */
export const TOTP_CHALLENGE_PURPOSE = 'totp-challenge'

export interface TotpChallengePayload {
  sub: string
  purpose: typeof TOTP_CHALLENGE_PURPOSE
}
