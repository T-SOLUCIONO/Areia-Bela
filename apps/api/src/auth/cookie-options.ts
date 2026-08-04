import type { CookieOptions } from 'express'
import type { ConfigService } from '@nestjs/config'

/**
 * How a session cookie is written, in one place.
 *
 * Three endpoints set one — staff access, staff refresh, guest session — and
 * they have to agree. They did, by having the same three lines copied into each
 * of them, which is agreement by luck.
 *
 * ## Why this is configurable at all
 *
 * `SameSite=Lax` is the right answer and the default. It is also what stops the
 * panel working when the site and the API sit on unrelated domains — two
 * `*.run.app` URLs, for instance — because the browser will not attach the
 * cookie to a cross-site request. Same parent domain (`areiabela.com` and
 * `api.areiabela.com`) keeps `Lax` and is the production posture.
 *
 * `none` exists for the case where that is not available yet, and it is not
 * free: see below.
 */
export type SameSite = 'lax' | 'none'

/**
 * What `Lax` was quietly doing, and what setting `none` gives up.
 *
 * This API has no CSRF token. `Lax` has been standing in for one: a request
 * from another site never carries the cookie, so it can never be authenticated.
 *
 * With `none` that stops being true, and what remains is:
 *
 * - **JSON endpoints are still safe.** `Content-Type: application/json` is not
 *   a "simple" request, so the browser sends a preflight first, and CORS
 *   answers with an allowlist the attacker's origin is not on. Everything that
 *   moves money — refunds, bookings, tax filings — is JSON.
 * - **Form bodies would not be.** A cross-site `<form>` posts without a
 *   preflight. Nest parses those by default, so `main.ts` turns that parser
 *   off: nothing here consumes a form, and a parser nobody needs is a door
 *   nobody watches.
 * - **The two image uploads remain reachable.** `multipart/form-data` is also
 *   preflight-free, so a crafted page could make a signed-in admin's browser
 *   upload a picture. It is the one hole `none` leaves open, it needs an admin
 *   already signed in, and the worst outcome is an unwanted image in the
 *   gallery. Declared rather than hidden.
 *
 * So `none` is a reasonable trade for a QA environment on two unrelated
 * domains, and the wrong default for production.
 *
 * ## Why `COOKIE_DOMAIN` exists
 *
 * `SameSite` decides whether a browser *attaches* a cookie to a cross-site
 * request. It says nothing about who can *read* one — and that turned out to
 * be the harder half.
 *
 * The panel is guarded by `apps/web/middleware.ts`, which runs on the web
 * server and reads the cookies sent to **its** host. A cookie the API set for
 * its own host never arrives there, so the guard sees nothing, and a guest who
 * has just authenticated is bounced back to the login screen for ever.
 *
 * Locally this never showed: `localhost:3000` and `localhost:3001` share the
 * host `localhost`, because cookies ignore the port. Two Cloud Run URLs do not
 * share anything — `run.app` is on the Public Suffix List, so each subdomain is
 * a separate site.
 *
 * Setting `COOKIE_DOMAIN=.example.com` with the site on `example.com` and the
 * API on `api.example.com` puts the cookie on the parent, where both can read
 * it. It also makes them the same site again, so `SameSite` goes back to `lax`
 * and the third-party-cookie problem disappears with it — Safari and private
 * windows included.
 *
 * The cost is that every subdomain of that parent can read the session cookie.
 * Worth knowing before pointing a third service at the same domain.
 */
export function sessionCookieOptions(config: ConfigService, base: CookieOptions): CookieOptions {
  const isProduction = config.get<string>('NODE_ENV') === 'production'
  const configured = config.get<string>('COOKIE_SAMESITE')?.toLowerCase()
  const sameSite: SameSite = configured === 'none' ? 'none' : 'lax'

  // Normalised to a leading dot. `.example.com` and `example.com` mean the
  // same thing to a modern browser, but the dot is what makes the intent
  // readable in a `Set-Cookie` header and in this configuration.
  const domain = config.get<string>('COOKIE_DOMAIN')?.trim()

  return {
    ...base,
    ...(domain ? { domain: domain.startsWith('.') ? domain : `.${domain}` } : {}),
    // Never readable from JavaScript, whatever else changes.
    httpOnly: true,
    // A browser rejects `SameSite=None` outright unless the cookie is
    // `Secure`, so this is not a preference either — asking for `none` over
    // plain HTTP would set no cookie at all, and the symptom would be a login
    // that silently does nothing.
    secure: isProduction || sameSite === 'none',
    sameSite,
  }
}
