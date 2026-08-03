import { expect, test } from '@playwright/test'

/**
 * The parts of a page nobody looks at.
 *
 * A canonical tag pointing at the wrong URL, an hreflang that goes missing, a
 * button a screen reader announces as "button" — none of these show up in a
 * browser, so nothing catches them except a test that goes looking.
 */

const LOCALES = ['es', 'en', 'pt', 'fr', 'de'] as const

test.describe('what a crawler reads', () => {
  test('robots keeps the panel and other people bookings out of the index', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text()

    expect(body).toContain('Disallow: /admin')
    // Not protection — the middleware and the API guards are that. This stops
    // a booking reference turning up in a search result.
    expect(body).toContain('/my-booking')
    expect(body).toContain('/confirmation')
    expect(body).toContain('Sitemap:')
  })

  test('the sitemap lists one house in five languages', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text()

    for (const locale of LOCALES) {
      expect(xml).toContain(`/${locale}</loc>`)
    }
    // A reader whose language is none of the five still has somewhere to go.
    expect(xml).toContain('hreflang="x-default"')

    // Checkout is a step in a transaction, not a page. Asking a crawler to
    // index it is asking it to index a shopping cart.
    expect(xml).not.toContain('/checkout')
    expect(xml).not.toContain('/my-booking')
  })

  test('every language declares the same page, not five rival ones', async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`)

      const canonical = page.locator('link[rel="canonical"]')
      await expect(canonical).toHaveAttribute('href', new RegExp(`/${locale}$`))

      // All five, on every one of them. A page that only names itself tells a
      // search engine the others are duplicates.
      for (const other of LOCALES) {
        await expect(page.locator(`link[rel="alternate"][hreflang="${other}"]`)).toHaveCount(1)
      }
    }
  })

  test('the house describes itself in a machine-readable way, without inventing', async ({
    page,
  }) => {
    await page.goto('/es')

    const raw = await page.locator('script[type="application/ld+json"]').first().textContent()
    // Absent is the correct answer when the API is down — blank fields would
    // tell a search engine the house has no address. So a failure here means
    // either the API is not running or the block genuinely broke.
    expect(raw, 'no structured data — is the API running?').toBeTruthy()
    const data = JSON.parse(raw!)

    expect(data['@type']).toBe('VacationRental')
    expect(data.address.addressLocality).toBeTruthy()
    expect(data.containsPlace.occupancy.maxValue).toBeGreaterThan(0)
    expect(data.containsPlace.numberOfBedrooms).toBeGreaterThan(0)

    // The reason this suite exists at all. A rating nobody left, a review count
    // nobody wrote, availability nobody checked — each of these is how a
    // listing earns a manual penalty, and none of them are in the database.
    expect(data.aggregateRating, 'a rating this house has not earned').toBeUndefined()
    expect(data.review, 'reviews nobody wrote').toBeUndefined()
  })
})

test.describe('what a screen reader hears', () => {
  test('every image on the home page has alternative text', async ({ page }) => {
    await page.goto('/es')
    await page.waitForLoadState('networkidle')

    const images = page.locator('img')
    const count = await images.count()
    expect(count).toBeGreaterThan(0)

    for (let index = 0; index < count; index += 1) {
      const image = images.nth(index)
      const alt = await image.getAttribute('alt')
      const src = await image.getAttribute('src')
      // An empty alt is a valid answer for decoration; a missing one is not an
      // answer at all.
      expect(alt, `an image with no alt: ${src}`).not.toBeNull()
    }
  })

  test('a button made of an icon still has a name', async ({ page }) => {
    await page.goto('/es')
    await page.waitForLoadState('networkidle')

    // The browser's own accessible-name computation, not an approximation of
    // it. A first version of this test checked text, aria-label and title by
    // hand and reported five false positives: an `<img alt="…">` inside a
    // button names that button, and no hand-rolled check knows that.
    const tree = await page.locator('body').ariaSnapshot()

    // A named button is `- button "…"`. A bare `- button` is one a screen
    // reader announces as nothing but its role.
    const unnamed = tree
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^- button(\s*\[|:|$)/.test(line))

    expect(unnamed, 'buttons a screen reader announces as just "button"').toEqual([])
  })

  test('the page says which language it is in', async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}`)
      // Without this a screen reader reads Spanish with an English voice.
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
    }
  })
})
