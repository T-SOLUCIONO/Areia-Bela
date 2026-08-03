import type { ConfigService } from '@nestjs/config'
import { sessionCookieOptions } from './cookie-options'

/**
 * The posture of every session cookie this system issues.
 *
 * Getting one of these wrong is not a bug anyone sees: a cookie without
 * `HttpOnly` is readable by any injected script, and `SameSite=None` without
 * `Secure` is a cookie the browser silently refuses — a login that appears to
 * do nothing at all.
 */
const configOf = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService

describe('sessionCookieOptions', () => {
  it('is Lax by default, which is the production posture', () => {
    const options = sessionCookieOptions(configOf({ NODE_ENV: 'production' }), { path: '/' })

    expect(options.sameSite).toBe('lax')
    expect(options.secure).toBe(true)
    expect(options.httpOnly).toBe(true)
  })

  it('stays Lax when asked for anything it does not recognise', () => {
    // A typo in an environment variable must not quietly weaken a cookie.
    for (const value of ['strict', 'None ', 'yes', '']) {
      expect(sessionCookieOptions(configOf({ COOKIE_SAMESITE: value }), {}).sameSite).toBe('lax')
    }
  })

  it('accepts None, in any casing', () => {
    for (const value of ['none', 'None', 'NONE']) {
      expect(sessionCookieOptions(configOf({ COOKIE_SAMESITE: value }), {}).sameSite).toBe('none')
    }
  })

  it('forces Secure alongside None, even outside production', () => {
    // Not a preference: a browser drops `SameSite=None` without `Secure`, so
    // the symptom would be a login that does nothing and says nothing.
    const options = sessionCookieOptions(
      configOf({ NODE_ENV: 'development', COOKIE_SAMESITE: 'none' }),
      {},
    )

    expect(options.sameSite).toBe('none')
    expect(options.secure).toBe(true)
  })

  it('leaves cookies insecure only in development, and only with Lax', () => {
    // Local development is plain HTTP; a `Secure` cookie would never be set.
    const options = sessionCookieOptions(configOf({ NODE_ENV: 'development' }), {})

    expect(options.secure).toBe(false)
    expect(options.sameSite).toBe('lax')
  })

  it('never lets a caller turn off HttpOnly', () => {
    const options = sessionCookieOptions(configOf({}), {
      // Whatever a call site passes, this one is not up for negotiation.
      httpOnly: false,
      path: '/',
      maxAge: 1000,
    } as never)

    expect(options.httpOnly).toBe(true)
    // The rest of the caller's options survive.
    expect(options.path).toBe('/')
    expect(options.maxAge).toBe(1000)
  })
})
