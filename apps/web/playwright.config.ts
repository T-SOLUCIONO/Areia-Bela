import { defineConfig, devices } from '@playwright/test'

const WEB = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const API = process.env.E2E_API_URL ?? 'http://localhost:3001'

/**
 * End-to-end, against the real API and a real database.
 *
 * Nothing is stubbed. The bugs this suite exists to catch were all in the seams
 * — a hold that outlived a failed payment, a quote the browser and the server
 * disagreed on — and a mocked API has no seams.
 *
 * Where it stops: the handoff to Stripe. Completing a payment means driving
 * Stripe's own hosted page, which is their UI to change and not ours to test.
 * What is asserted is that the handoff is real: a session URL that belongs to
 * Stripe, for a booking that exists.
 */
export default defineConfig({
  testDir: './e2e',
  // Bookings are rows in one shared database and the calendar is one house, so
  // two workers racing for the same week would fail each other rather than the
  // code.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: WEB,
    // Only on a failure: a passing suite that writes 40 traces is a suite
    // nobody runs locally.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Started only when nothing is already listening, so a local run reuses the
  // dev server the developer already has open.
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'pnpm --filter @areia-bela/web dev',
        url: WEB,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },

  metadata: { api: API },
})
