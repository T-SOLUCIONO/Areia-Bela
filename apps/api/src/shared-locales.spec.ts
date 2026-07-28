import { SUPPORTED_LOCALES, pathForLocale, stripLocale } from '@areia-bela/shared'

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
