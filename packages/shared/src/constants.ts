/**
 * Canonical business constants from docs/domain-decisions.md.
 * Reference data for the Fase 3 Prisma seed and future API validation —
 * not yet wired into apps/web, which still reads its own
 * lib/property-data.ts. Rewiring the live booking flow to this source
 * is deferred to keep Fase 2 changes low-risk.
 */

export const PROPERTY_MAX_GUESTS = 8
export const ADDITIONAL_GUEST_FEE_PER_NIGHT = 30

export const HEATED_POOL_SEASON = {
  startMonthDay: '10-01',
  endMonthDay: '05-01',
  pricePerNight: 20,
} as const

export const NANNY_PRICE_PER_HOUR = 20
export const PET_FEE_PER_STAY = 100

export const PENALTIES = {
  poolFilterDamagedByPet: 150,
  trashNotTakenOut: 50,
  unauthorizedParty: 999,
} as const

export const CHECK_IN_TIME = '16:00'
export const CHECK_OUT_TIME = '10:00'

export const TRASH_COLLECTION_DAYS = ['wednesday', 'saturday'] as const

export const SUPPORTED_LOCALES = ['es', 'en', 'pt', 'fr', 'de'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/**
 * The language content is authored in. Everything else is a translation of it,
 * so this is also the fallback when a translation is missing or out of date —
 * a guest reading Spanish on a French page is better than a blank one.
 */
export const DEFAULT_LOCALE: SupportedLocale = 'es'

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Removes the leading locale from a path so it can be re-prefixed.
 *
 * Lives beside SUPPORTED_LOCALES on purpose. The header used to carry its own
 * copy that only knew `en` and `es`, so from `/pt` it appended rather than
 * replaced and produced `/en/pt`, which 404s. Anything that needs this must
 * import it rather than re-derive it.
 */
export function stripLocale(pathname: string): string {
  for (const locale of SUPPORTED_LOCALES) {
    if (pathname === `/${locale}`) return '/'
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1)
  }
  return pathname
}

/**
 * Reads `Accept-Language` in the browser's stated order of preference.
 *
 * `fr-CA;q=0.9` counts as French: the region is dropped and the q-values are
 * respected, rather than taking whichever tag happens to come first.
 */
export function localeFromAcceptLanguage(header: string): SupportedLocale | null {
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const quality = params.find((param) => param.trim().startsWith('q='))
      return {
        tag: tag.trim().toLowerCase().split('-')[0] ?? '',
        q: quality ? Number(quality.split('=')[1]) : 1,
      }
    })
    .filter((entry) => !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q)

  const match = ranked.find((entry) => isSupportedLocale(entry.tag))
  return match ? (match.tag as SupportedLocale) : null
}

/**
 * Fills `{name}` placeholders in a translated string.
 *
 * Shared by both dictionaries: the guest site needs it for "for {count}
 * nights", and the admin for "{count} photos".
 */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`)
}

/** The same path under a different language. */
export function pathForLocale(pathname: string, locale: SupportedLocale): string {
  const rest = stripLocale(pathname)
  return rest === '/' ? `/${locale}` : `/${locale}${rest}`
}
