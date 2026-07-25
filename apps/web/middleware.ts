import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '@areia-bela/shared'

function detectLocale(request: NextRequest): SupportedLocale {
  // A previously chosen language wins over the browser header.
  const saved = request.cookies.get('areia_bela_language')?.value
  if (saved === 'es' || saved === 'en') return saved

  const acceptLanguage = (request.headers.get('accept-language') ?? '').toLowerCase()
  if (acceptLanguage.startsWith('es')) return 'es'
  if (acceptLanguage.startsWith('en')) return 'en'
  return DEFAULT_LOCALE
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
     * Only rewrite the public site. Admin, API routes, Next internals
     * and static files (anything with a file extension) are excluded
     * so today's behavior for those paths is unchanged.
     */
    '/((?!admin|api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
