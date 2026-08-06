import { test, expect } from '@playwright/test'

/**
 * The homepage must never come out empty.
 *
 * Every section below the hero renders only when the CMS is "available", and
 * `available` used to mean nothing more than *the request did not fail*. A
 * fresh environment where `seed:cms` had not been run answered with zero
 * sections, the page believed the CMS had spoken, and QA shipped a hero, a
 * booking card and blank space beneath. No error anywhere.
 *
 * These sections come from the CMS when it has content and from the bundled
 * copy when it does not, so the page owes the guest all of them either way.
 */
const SECTIONS = ['gallery', 'reviews', 'location'] as const

test('renders its sections, seeded CMS or not', async ({ page }) => {
  await page.goto('/es', { waitUntil: 'networkidle' })

  for (const id of SECTIONS) {
    await expect(page.locator(`#${id}`), `falta la sección #${id}`).toHaveCount(1)
  }

  // A page carrying only the hero would still pass the checks above if the
  // anchors existed but held nothing, so this asks for actual prose.
  const words = await page.evaluate(() => document.body.innerText.trim().split(/\s+/).length)
  expect(words, `la página trae ${words} palabras, parece vacía`).toBeGreaterThan(150)
})

test('the navigation anchors land somewhere', async ({ page }) => {
  await page.goto('/es', { waitUntil: 'networkidle' })

  // Menu items pointing at nothing are the same failure seen from the header:
  // the link works, the page does not move, and nobody is told why.
  // Resuelto dentro de la página: `CSS.escape` es del navegador, y comprobarlo
  // desde Node obligaría a reimplementarlo.
  const { total, orphans } = await page.evaluate(() => {
    const ids = new Set(
      Array.from(document.querySelectorAll('a[href^="#"]'))
        .map((a) => (a.getAttribute('href') ?? '').slice(1))
        .filter((id) => id.length > 0),
    )
    return {
      total: ids.size,
      orphans: [...ids].filter((id) => !document.getElementById(id)).map((id) => `#${id}`),
    }
  })
  expect(total, 'la cabecera no tiene enlaces de ancla').toBeGreaterThan(0)
  expect(orphans, `anclas que no llevan a ninguna parte: ${orphans.join(', ')}`).toEqual([])
})
