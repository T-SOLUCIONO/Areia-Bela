import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
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

  it('shares the cookie with the parent domain when told to', () => {
    // The half `SameSite` does not solve: the panel's middleware runs on the
    // web host and can only read cookies sent to it. Without this, a login
    // succeeds and the guard still sees nothing.
    const options = sessionCookieOptions(configOf({ COOKIE_DOMAIN: 'areiabela.com' }), {})

    expect(options.domain).toBe('.areiabela.com')
  })

  it('does not double the leading dot', () => {
    expect(sessionCookieOptions(configOf({ COOKIE_DOMAIN: '.areiabela.com' }), {}).domain).toBe(
      '.areiabela.com',
    )
  })

  it('sets no domain at all when unset, which is right for one host', () => {
    // A `Domain` on localhost would be wrong, and an empty string is not a
    // domain — it would produce `Domain=.` and the browser would drop it.
    expect(sessionCookieOptions(configOf({}), {}).domain).toBeUndefined()
    expect(sessionCookieOptions(configOf({ COOKIE_DOMAIN: '   ' }), {}).domain).toBeUndefined()
  })

  it('is the only way any cookie gets cleared', () => {
    // Not style. A cookie is identified by name **and domain and path**, so
    // `clearCookie(name, { path })` next to a `res.cookie` that carries a
    // domain deletes a cookie that does not exist and leaves the real one in
    // the browser. The logout returns 204, the session survives, and nothing
    // anywhere says so. It happened once; this is what stops it happening
    // again, because the mistake lives at the call site and not in here.
    const offenders: string[] = []
    let inspected = 0

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(path)
          continue
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) continue

        const source = readFileSync(path, 'utf8')
        for (let at = source.indexOf('clearCookie('); at !== -1;) {
          // Walk to the matching parenthesis: the arguments contain their own,
          // so anything simpler stops at the wrong place.
          let depth = 0
          let end = source.indexOf('(', at)
          do {
            if (source[end] === '(') depth += 1
            else if (source[end] === ')') depth -= 1
            end += 1
          } while (depth > 0 && end < source.length)

          const call = source.slice(at, end)
          inspected += 1
          if (!call.includes('sessionCookieOptions')) {
            offenders.push(`${path}: ${call.replace(/\s+/g, ' ')}`)
          }
          at = source.indexOf('clearCookie(', end)
        }
      }
    }

    walk(join(__dirname, '..'))

    expect(offenders).toEqual([])
    // A scan that finds nothing passes for the wrong reason. Three cookies get
    // cleared today: staff access, staff refresh, guest session.
    expect(inspected).toBeGreaterThanOrEqual(3)
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
