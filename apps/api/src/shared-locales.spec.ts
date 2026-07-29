import {
  SUPPORTED_LOCALES,
  localeFromAcceptLanguage,
  pathForLocale,
  stripLocale,
} from '@areia-bela/shared'

/**
 * These live in @areia-bela/shared but are tested here, because the API is the
 * only workspace with a test runner today (adding one to the web app is Fase 8).
 *
 * They earn a test: the header used to carry its own copy of this logic that
 * only knew `en` and `es`, so switching to English from `/pt` produced
 * `/en/pt` — a 404 rather than a translated page.
 */
describe('stripLocale', () => {
  it.each(SUPPORTED_LOCALES)('strips a bare /%s', (locale) => {
    expect(stripLocale(`/${locale}`)).toBe('/')
  })

  it.each(SUPPORTED_LOCALES)('strips /%s from a deeper path', (locale) => {
    expect(stripLocale(`/${locale}/checkout`)).toBe('/checkout')
  })

  it('leaves a path that carries no locale alone', () => {
    expect(stripLocale('/checkout')).toBe('/checkout')
  })

  it('does not strip a segment that merely starts with a locale', () => {
    // "/entrada" begins with "en" without being the English prefix.
    expect(stripLocale('/entrada')).toBe('/entrada')
    expect(stripLocale('/deutschland')).toBe('/deutschland')
  })

  it('leaves the root alone', () => {
    expect(stripLocale('/')).toBe('/')
  })
})

describe('pathForLocale', () => {
  it('replaces the locale instead of appending it', () => {
    // The bug: this used to return "/en/pt".
    expect(pathForLocale('/pt', 'en')).toBe('/en')
    expect(pathForLocale('/es', 'de')).toBe('/de')
  })

  it('keeps the rest of the path', () => {
    expect(pathForLocale('/fr/checkout', 'pt')).toBe('/pt/checkout')
  })

  it('adds the locale to a path that has none', () => {
    expect(pathForLocale('/', 'fr')).toBe('/fr')
    expect(pathForLocale('/checkout', 'fr')).toBe('/fr/checkout')
  })

  it('is a no-op when the locale is already the current one', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(pathForLocale(`/${locale}/checkout`, locale)).toBe(`/${locale}/checkout`)
    }
  })

  it('never produces two locale segments, from any language to any other', () => {
    for (const from of SUPPORTED_LOCALES) {
      for (const to of SUPPORTED_LOCALES) {
        const result = pathForLocale(`/${from}`, to)
        expect(result).toBe(`/${to}`)
        expect(result.split('/').filter(Boolean)).toHaveLength(1)
      }
    }
  })
})

describe('localeFromAcceptLanguage', () => {
  it('picks the first supported language', () => {
    expect(localeFromAcceptLanguage('fr,en;q=0.8')).toBe('fr')
  })

  it('drops the region', () => {
    // "fr-CA" is still French.
    expect(localeFromAcceptLanguage('fr-CA')).toBe('fr')
    expect(localeFromAcceptLanguage('pt-BR,en;q=0.5')).toBe('pt')
  })

  it('respects q-values rather than document order', () => {
    // German is listed second but wanted more.
    expect(localeFromAcceptLanguage('en;q=0.3,de;q=0.9')).toBe('de')
  })

  it('skips languages the site does not speak', () => {
    expect(localeFromAcceptLanguage('ja,ko;q=0.9,de;q=0.1')).toBe('de')
  })

  it('returns null when none match, so the caller can pick the default', () => {
    expect(localeFromAcceptLanguage('ja,ko')).toBeNull()
    expect(localeFromAcceptLanguage('')).toBeNull()
  })
})
