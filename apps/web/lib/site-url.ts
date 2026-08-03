import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@areia-bela/shared'

/**
 * Where this site lives, for the things that cannot be relative.
 *
 * A canonical URL, an hreflang and an Open Graph image all have to be absolute:
 * a crawler reading them has no page to resolve them against, and a link shared
 * on WhatsApp is read by a server that never visited the site.
 *
 * Falls back to localhost rather than guessing a domain. A wrong absolute URL
 * in a canonical tag tells Google the real page is somewhere else, which is
 * worse than a development one nobody crawls.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '')

/**
 * The same page in every language, for `alternates.languages`.
 *
 * Without this a five-language site looks to a search engine like five pages
 * competing for the same words. With it they are one page in five languages,
 * and the right one is offered to the right reader.
 */
export function languageAlternates(path = ''): Record<string, string> {
  const clean = path.replace(/^\/+/, '')
  const suffix = clean ? `/${clean}` : ''

  const alternates: Record<string, string> = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, `${SITE_URL}/${locale}${suffix}`]),
  )
  // What a reader whose language is none of the five should be sent to.
  alternates['x-default'] = `${SITE_URL}/${DEFAULT_LOCALE}${suffix}`
  return alternates
}
