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

/**
 * Language preference, shared by the guest site and the admin. Lives here
 * rather than in a component module because server components read it too,
 * and a value imported from a 'use client' file resolves to undefined there.
 */
export const LANGUAGE_COOKIE = 'areia_bela_language'
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

/**
 * Lifetime of an emailed password-reset link. Short because the link travels
 * through email, a channel we don't control.
 */
export const PASSWORD_RESET_TTL_MINUTES = 60

/** Minimum length for any password the app accepts. */
export const MIN_PASSWORD_LENGTH = 12

/**
 * How long an invitation link stays valid. Longer than a password reset:
 * a reset is a deliberate act you follow up on immediately, while an
 * invitation lands unannounced and may sit in an inbox for a day or two.
 */
export const INVITATION_TTL_HOURS = 72

export const ADMIN_LOGIN_PATH = '/admin/login'

/**
 * Admin routes reachable without a session. Anything under /admin not listed
 * here is gated by the middleware — password recovery has to be usable by
 * someone who, by definition, can't sign in.
 */
export const PUBLIC_ADMIN_PATHS = [
  ADMIN_LOGIN_PATH,
  '/admin/forgot-password',
  '/admin/reset-password',
] as const

// --- Guest area ------------------------------------------------------------

/**
 * Guests sign in with a link emailed to them, never a password.
 *
 * A password would be a credential the guest has to invent, remember and reuse
 * for one or two stays a year, and one more thing for this house to store and
 * be responsible for. The email address is already the identifier a booking is
 * made under, so proving control of it is proof enough.
 *
 * An hour, not fifteen minutes: the case that breaks a short link is not
 * "tomorrow" — the session below covers that — it is asking for a link and
 * being interrupted. An hour survives that and still means a forwarded email
 * stops being a key the same afternoon.
 */
export const GUEST_LOGIN_TTL_MINUTES = 60

/**
 * How long a guest stays signed in.
 *
 * Longer than the staff access token because the blast radius is smaller — a
 * guest sees their own bookings and can edit their own contact details — and
 * because asking someone to re-request a link on every visit would make the
 * area useless. There is no refresh rotation here; the trade-off is stated in
 * docs/changelog.md.
 */
export const GUEST_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

export const GUEST_SESSION_COOKIE = 'areia_bela_guest'

/** Marks a token as a guest session, so it can never authenticate an admin. */
export const GUEST_TOKEN_AUDIENCE = 'guest'

export const GUEST_AREA_PATH = '/my-booking'
