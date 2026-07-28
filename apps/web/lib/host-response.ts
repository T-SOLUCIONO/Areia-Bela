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
  pt: {
    'within-an-hour': 'Responde em menos de uma hora',
    'within-a-few-hours': 'Responde em poucas horas',
    'within-a-day': 'Responde em um dia',
    unknown: null,
  },
  fr: {
    'within-an-hour': "Répond en moins d'une heure",
    'within-a-few-hours': 'Répond en quelques heures',
    'within-a-day': 'Répond dans la journée',
    unknown: null,
  },
  de: {
    'within-an-hour': 'Antwortet innerhalb einer Stunde',
    'within-a-few-hours': 'Antwortet innerhalb weniger Stunden',
    'within-a-day': 'Antwortet innerhalb eines Tages',
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
  pt: {
    'within-an-hour': 'costuma responder em menos de uma hora.',
    'within-a-few-hours': 'costuma responder em poucas horas.',
    'within-a-day': 'costuma responder em um dia.',
    unknown: 'responderá em breve.',
  },
  fr: {
    'within-an-hour': "répond généralement en moins d'une heure.",
    'within-a-few-hours': 'répond généralement en quelques heures.',
    'within-a-day': 'répond généralement dans la journée.',
    unknown: 'vous répondra bientôt.',
  },
  de: {
    'within-an-hour': 'antwortet meist innerhalb einer Stunde.',
    'within-a-few-hours': 'antwortet meist innerhalb weniger Stunden.',
    'within-a-day': 'antwortet meist innerhalb eines Tages.',
    unknown: 'meldet sich bald bei Ihnen.',
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
  pt: {
    'within-an-hour': '< 1 hora',
    'within-a-few-hours': 'Poucas horas',
    'within-a-day': '< 1 dia',
    unknown: '—',
  },
  fr: {
    'within-an-hour': '< 1 heure',
    'within-a-few-hours': 'Quelques heures',
    'within-a-day': '< 1 jour',
    unknown: '—',
  },
  de: {
    'within-an-hour': '< 1 Stunde',
    'within-a-few-hours': 'Wenige Stunden',
    'within-a-day': '< 1 Tag',
    unknown: '—',
  },
}
