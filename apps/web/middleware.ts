import { NextResponse, type NextRequest } from 'next/server'
import {
  ACCESS_TOKEN_COOKIE,
  ADMIN_LOGIN_PATH,
  PUBLIC_ADMIN_PATHS,
  DEFAULT_LOCALE,
  LANGUAGE_COOKIE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  localeFromAcceptLanguage,
  type SupportedLocale,
} from '@areia-bela/shared'

function detectLocale(request: NextRequest): SupportedLocale {
  // A previously chosen language wins over the browser header. This used to
  // compare against a hard-coded `'es' | 'en'`, so picking Portuguese saved a
  // cookie the middleware then ignored — the choice was lost on the next visit
  // to a path without a locale prefix.
  const saved = request.cookies.get(LANGUAGE_COOKIE)?.value
  if (saved && isSupportedLocale(saved)) return saved

  return localeFromAcceptLanguage(request.headers.get('accept-language') ?? '') ?? DEFAULT_LOCALE
}

/**
 * First of two layers protecting /admin. This one only checks that a session
 * cookie is present, which is enough to bounce anonymous visitors without a
 * round trip — and deliberately does not verify the signature, so the JWT
 * secret never has to exist in the frontend.
 *
 * The real verification happens server-side in the admin layout (which calls
 * GET /auth/me) and in the NestJS guards on every API request. A forged cookie
 * gets past here and dies there.
 */
function guardAdmin(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Login and password recovery must stay reachable: the first would loop
  // redirects, and the others are for people who cannot sign in by definition.
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(`${publicPath}/`),
  )
  if (isPublicAdminPath) {
    return NextResponse.next()
  }

  if (request.cookies.has(ACCESS_TOKEN_COOKIE)) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = ADMIN_LOGIN_PATH
  // Remembered so the user lands where they were headed after signing in.
  url.searchParams.set('from', pathname)
  return NextResponse.redirect(url)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return guardAdmin(request)
  }

  const hasLocalePrefix = SUPPORTED_LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  )
  if (hasLocalePrefix) return NextResponse.next()

  const locale = detectLocale(request)
  const url = request.nextUrl.clone()
  url.pathname = `/${locale}${pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: [
    /*
     * Public site: everything except admin, API routes, Next internals and
     * static files (anything with a file extension) gets the locale rewrite.
     */
    '/((?!admin|api|preview|_next/static|_next/image|favicon.ico|.*\\..*).*)',
    // Admin is matched separately so it reaches guardAdmin instead of the
    // locale rewrite, which would turn /admin into /es/admin and 404.
    '/admin',
    '/admin/:path*',
  ],
}
