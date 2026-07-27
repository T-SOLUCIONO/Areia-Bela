/**
 * Auth constants shared between the API (which issues the cookies) and the
 * Next.js middleware (which checks for them before rendering /admin).
 *
 * Secrets never live here — only names and durations. See docs/env.md.
 */

/** Short-lived on purpose: a stolen access token expires fast. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60

/** Rotated on every use, so a leaked refresh token is single-use at worst. */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

export const ACCESS_TOKEN_COOKIE = 'areia_bela_access'
export const REFRESH_TOKEN_COOKIE = 'areia_bela_refresh'

/** Path the refresh cookie is scoped to, so it isn't sent on every request. */
export const REFRESH_COOKIE_PATH = '/auth/refresh'

/** Brute-force lockout: consecutive failures before the account is locked. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5
export const ACCOUNT_LOCKOUT_MINUTES = 15

/**
 * Window to enter the 2FA code after the password step. Short enough that an
 * abandoned half-login can't be resumed much later.
 */
export const TOTP_CHALLENGE_TTL_SECONDS = 5 * 60

/** How many single-use recovery codes are generated when 2FA is enabled. */
export const RECOVERY_CODE_COUNT = 10

export const ADMIN_LOGIN_PATH = '/admin/login'
