import { test, expect } from '@playwright/test'

/**
 * The page must render the same on the server and in the guest's browser.
 *
 * This is not a style rule. The server renders in its own timezone and the
 * browser hydrates in the guest's, so anything derived from the clock during
 * render disagrees across that gap for several hours every day. React answers a
 * mismatch by throwing the server's markup away and repainting — the work of
 * server rendering, discarded, on the one card the page exists to show.
 *
 * It shipped to QA and nobody saw it, because the second paint lands with the
 * right dates. The only evidence was `#418` in the console.
 *
 * Cloud Run runs UTC and the house is in Florida: from about 8pm local, the two
 * were on different dates. The timezones below sit either side of the line so
 * one of them always disagrees with whatever the test machine is set to.
 */
const ACROSS_THE_DATE_LINE = ['Pacific/Kiritimati', 'Pacific/Midway'] as const

for (const timezoneId of ACROSS_THE_DATE_LINE) {
  test(`hydrates cleanly with the browser in ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId })
    const page = await context.newPage()

    const mismatches: string[] = []
    const record = (text: string) => {
      // #418 text, #423 recoverable, #425 text-content — all the same fault.
      if (/hydrat|did not match|#418|#423|#425/i.test(text)) mismatches.push(text.slice(0, 300))
    }
    page.on('console', (message) => record(message.text()))
    page.on('pageerror', (error) => record(error.message))

    await page.goto('/es', { waitUntil: 'networkidle' })
    // The booking card fills its dates in an effect, so give that a moment:
    // a mismatch reported after this assertion would be missed.
    await page.waitForTimeout(2000)

    await context.close()

    expect(
      mismatches,
      `Desajuste de hidratación en ${timezoneId}:\n${mismatches.join('\n')}`,
    ).toHaveLength(0)
  })
}
