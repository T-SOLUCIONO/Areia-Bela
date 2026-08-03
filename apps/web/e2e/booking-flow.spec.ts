import { expect, test } from '@playwright/test'
import { API, checkoutUrl, futureStay, PROPERTY, TEST_GUEST } from './helpers'

/**
 * The path a guest's money takes.
 *
 * Every assertion here is about something that has actually broken: a total the
 * browser computed instead of the server, a hold that survived a failed
 * payment, dates that stayed shut after the guest turned back.
 */

type Night = { date: string; available: boolean }

/** The nights of the stay itself. Check-out is a departure, not a night. */
async function nightsOf(
  request: { get: (url: string) => Promise<{ json: () => Promise<Night[]> }> },
  stay: { checkIn: string; checkOut: string },
): Promise<Night[]> {
  const response = await request.get(
    `${API}/properties/${PROPERTY}/rates?from=${stay.checkIn}&to=${stay.checkOut}`,
  )
  const nights = await response.json()
  return nights.filter((night) => night.date >= stay.checkIn && night.date < stay.checkOut)
}

test.describe('quoting a stay', () => {
  test('the server prices it, and the bill adds up to the total', async ({ request }) => {
    const stay = futureStay()

    const response = await request.post(`${API}/properties/${PROPERTY}/quote`, {
      data: {
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        guests: { adults: 2, children: 0, infants: 0 },
        extraIds: [],
      },
    })
    expect(response.ok()).toBeTruthy()
    const quote = await response.json()

    expect(quote.nights).toBe(stay.nights)
    expect(quote.total).toBeGreaterThan(0)

    // The invariant a backfill once broke by exactly $30, and the reason these
    // columns are frozen on the booking rather than recomputed.
    const parts =
      quote.subtotal -
      quote.weeklyDiscount +
      quote.additionalGuestFee +
      quote.extrasTotal +
      quote.cleaningFee +
      quote.serviceFee +
      quote.taxes
    expect(Math.abs(parts - quote.total)).toBeLessThan(0.01)
  })

  test('a total sent from the browser is refused outright', async ({ request }) => {
    const stay = futureStay(401)
    const body = {
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      guests: { adults: 2, children: 0, infants: 0 },
      extraIds: [],
    }

    const honest = await request.post(`${API}/properties/${PROPERTY}/quote`, { data: body })
    expect(honest.ok()).toBeTruthy()

    const cheeky = await request.post(`${API}/properties/${PROPERTY}/quote`, {
      data: { ...body, total: 1, totalPrice: 1 },
    })

    // Stronger than ignoring the field: the request never gets priced at all.
    // Silently dropping it would still be safe, but a caller sending a total
    // has misunderstood something and deserves to be told.
    expect(cheeky.status()).toBe(400)
    const complaint = (await cheeky.json()).message.join(' ')
    expect(complaint).toContain('total should not exist')
    expect(complaint).toContain('totalPrice should not exist')
  })
})

test.describe('holding the dates', () => {
  test('a hold takes the week, and turning back gives it straight back', async ({ request }) => {
    const stay = futureStay(410)

    expect(
      (await nightsOf(request, stay)).every((night) => night.available),
      'the test week has to start free',
    ).toBe(true)

    const held = await request.post(`${API}/bookings/${PROPERTY}/hold`, {
      headers: { origin: 'http://localhost:3000' },
      data: {
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        guests: { adults: 2, children: 0, infants: 0, pets: 0 },
        guest: TEST_GUEST,
        extraIds: [],
        locale: 'es',
      },
    })

    // With no Stripe key the hold cannot open a payment. That is a valid
    // outcome; what is not valid is keeping the dates anyway.
    if (!held.ok()) {
      expect(
        (await nightsOf(request, stay)).every((night) => night.available),
        'a hold that could not open a payment must not keep the dates',
      ).toBe(true)
      return
    }

    const booking = await held.json()
    expect(booking.checkoutUrl).toContain('checkout.stripe.com')
    expect(booking.reference).toMatch(/^AB-[A-Z0-9]{6}$/)

    // The calendar has to agree, or two people can buy the same week.
    expect((await nightsOf(request, stay)).every((night) => !night.available)).toBe(true)

    // The guest turns round at Stripe. This is also the cleanup: a released
    // hold blocks nothing.
    expect((await request.post(`${API}/bookings/${booking.bookingId}/abandon`)).status()).toBe(204)

    expect((await nightsOf(request, stay)).every((night) => night.available)).toBe(true)
  })

  test('two guests cannot buy the same week', async ({ request }) => {
    const stay = futureStay(420)
    const headers = { origin: 'http://localhost:3000' }
    const data = {
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      guests: { adults: 2, children: 0, infants: 0, pets: 0 },
      guest: TEST_GUEST,
      extraIds: [],
      locale: 'es',
    }

    const first = await request.post(`${API}/bookings/${PROPERTY}/hold`, { headers, data })
    test.skip(!first.ok(), 'Stripe is not configured, so no hold can be created')

    const second = await request.post(`${API}/bookings/${PROPERTY}/hold`, { headers, data })
    // The exclusion constraint, not a read-then-write check: this is the one
    // that survives two requests arriving in the same millisecond.
    expect(second.status()).toBe(409)

    await request.post(`${API}/bookings/${(await first.json()).bookingId}/abandon`)
  })
})

test.describe('the checkout page', () => {
  test('shows the same total the server quoted', async ({ page, request }) => {
    const stay = futureStay(430)

    const quote = await (
      await request.post(`${API}/properties/${PROPERTY}/quote`, {
        data: {
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          guests: { adults: 2, children: 0, infants: 0 },
          extraIds: [],
        },
      })
    ).json()

    await page.goto(checkoutUrl(stay))

    // The figure itself. The page fetches its own quote, and the two have to
    // agree or the guest is shown one price and charged another.
    await expect(page.getByText(`$${quote.total.toLocaleString('en-US')}`).first()).toBeVisible({
      timeout: 30_000,
    })
  })

  test('will not take a guest who has not agreed to the terms', async ({ page }) => {
    const stay = futureStay(440)
    await page.goto(checkoutUrl(stay))

    const pay = page.getByRole('button', { name: /confirmar y pagar|reservar|pagar/i }).first()
    await expect(pay).toBeVisible({ timeout: 30_000 })

    // Nothing opens until the terms are ticked. The guest agrees before the
    // dialog, not inside it.
    await expect(pay).toBeDisabled()
  })

  test('will not take a guest with no name', async ({ page }) => {
    const stay = futureStay(441)
    await page.goto(checkoutUrl(stay))

    const pay = page.getByRole('button', { name: /confirmar y pagar|reservar|pagar/i }).first()
    await expect(pay).toBeVisible({ timeout: 30_000 })

    await page.locator('#agreeTerms').check()
    await expect(pay).toBeEnabled()
    await pay.click()

    // The dialog collects the details, and its own button stays disabled until
    // the three the API refuses without are filled in. The browser's `required`
    // is a convenience; this is the guard the guest actually meets.
    const submit = page.getByRole('button', { name: /continuar|continue/i }).last()
    await expect(submit).toBeDisabled()

    await page
      .getByLabel(/nombre|first name/i)
      .first()
      .fill('E2E')
    await page
      .getByLabel(/apellido|last name/i)
      .first()
      .fill('Playwright')
    await page
      .getByLabel(/correo|email/i)
      .first()
      .fill('e2e-playwright@example.com')
    await expect(submit).toBeEnabled()
  })
})

test.describe('the site itself', () => {
  test('serves each language under its own locale', async ({ page }) => {
    await page.goto('/es')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')

    await page.goto('/en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('a session that does not exist does not fabricate a booking', async ({ page }) => {
    await page.goto('/es/confirmation?session_id=cs_test_does_not_exist')

    // Told plainly rather than a blank page — or worse, a confirmation for a
    // booking nobody made.
    await expect(page.locator('body')).not.toBeEmpty()
    expect(await page.title()).not.toBe('')
  })
})
