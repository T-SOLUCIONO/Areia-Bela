import type { Language } from '@/lib/i18n'
import type { ResponseTimeKey } from '@/lib/property-data'

/**
 * The scraped `responseTimeWithoutNa` is a locale-locked Spanish sentence
 * ("en menos de una hora"), so it can never be interpolated after a translated
 * prefix — that produced "Responds in en menos de una hora" in English and
 * "Responde en en menos de una hora" in Spanish. `normalizeResponseTime` in
 * property-data.ts collapses it to a key; these are the phrasings per surface.
 */
type ResponseLabels = Record<ResponseTimeKey, string>

/** Badge form: a standalone sentence. `null` when we have no data to show. */
export const RESPONSE_TIME_BADGE: Record<Language, Record<ResponseTimeKey, string | null>> = {
  en: {
    'within-an-hour': 'Responds within an hour',
    'within-a-few-hours': 'Responds within a few hours',
    'within-a-day': 'Responds within a day',
    unknown: null,
  },
  es: {
    'within-an-hour': 'Responde en menos de una hora',
    'within-a-few-hours': 'Responde en pocas horas',
    'within-a-day': 'Responde en un día',
    unknown: null,
  },
}

/** Clause form: follows the host's first name. */
export const RESPONSE_TIME_CLAUSE: Record<Language, ResponseLabels> = {
  en: {
    'within-an-hour': 'usually replies within an hour.',
    'within-a-few-hours': 'usually replies within a few hours.',
    'within-a-day': 'usually replies within a day.',
    unknown: 'will get back to you soon.',
  },
  es: {
    'within-an-hour': 'suele responder en menos de una hora.',
    'within-a-few-hours': 'suele responder en pocas horas.',
    'within-a-day': 'suele responder en un día.',
    unknown: 'te responderá pronto.',
  },
}

/** Compact form: fits inside a small stat tile. */
export const RESPONSE_TIME_COMPACT: Record<Language, ResponseLabels> = {
  en: {
    'within-an-hour': '< 1 hour',
    'within-a-few-hours': 'A few hours',
    'within-a-day': '< 1 day',
    unknown: '—',
  },
  es: {
    'within-an-hour': '< 1 hora',
    'within-a-few-hours': 'Pocas horas',
    'within-a-day': '< 1 día',
    unknown: '—',
  },
}
