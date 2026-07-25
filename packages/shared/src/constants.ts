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

export const SUPPORTED_LOCALES = ['es', 'en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = 'es'
