import { test, expect, type Page } from '@playwright/test'

/**
 * The quoter's calendar, from the guest's side.
 *
 * All three of these shipped broken at once and none of them looked like an
 * error: the card opened on a stay nobody asked for, the first tap on a day was
 * swallowed, and picking a single night threw the range away. The page never
 * complained — it just would not take an answer.
 */

/** What the collapsed date box reads when nothing is chosen. */
const EMPTY = 'Agregar fecha'

const dayKey = (offsetDays: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

/** Arrival and departure, as the trigger shows them. */
const chosenDates = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('span'))
      .filter((el) => /^(LLEGADA|SALIDA)$/i.test((el.textContent ?? '').trim()))
      .map((el) => (el.nextElementSibling?.textContent ?? '').trim()),
  )

/**
 * Hover, then click — the way a pointer actually arrives at a day.
 *
 * Playwright's plain `click()` moves and presses in one go. The calendar
 * repaints its preview band on hover, so an atomic click can straddle that
 * repaint in a way no hand does.
 */
async function pickDay(page: Page, offsetDays: number) {
  const day = page.locator(`button[data-day="${dayKey(offsetDays)}"]`).first()
  await day.hover()
  await page.waitForTimeout(150)
  await day.click()
  await page.waitForTimeout(400)
}

// Declarado con `test.use` y no con `setViewportSize` en un `beforeEach`: el
// segundo se aplica también a los tests de móvil de abajo y les impone 1440px,
// que es exactamente lo que no queremos medir ahí.
test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/es', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
})

test('opens with no dates chosen', async ({ page }) => {
  // It used to propose a stay computed from `new Date()` during render — which
  // the server, on UTC, got wrong for every American evening.
  expect(await chosenDates(page)).toEqual([EMPTY, EMPTY])
})

test('one click sets the arrival', async ({ page }) => {
  await page.locator('text=/LLEGADA/i').first().click()
  await page.waitForTimeout(700)

  await pickDay(page, 40)

  const [arrival, departure] = await chosenDates(page)
  expect(arrival, 'the first click must land').not.toBe(EMPTY)
  expect(departure, 'and leave the departure open').toBe(EMPTY)
})

test('accepts a single night', async ({ page }) => {
  await page.locator('text=/LLEGADA/i').first().click()
  await page.waitForTimeout(700)

  await pickDay(page, 40)
  await pickDay(page, 41)

  const [arrival, departure] = await chosenDates(page)
  // `min` was `minNights + 1` and react-day-picker counts nights, so one night
  // was silently rejected: the range vanished and the arrival jumped.
  expect(departure).not.toBe(EMPTY)
  expect(arrival).not.toBe(departure)
})

test('clicking a new day replaces a finished stay', async ({ page }) => {
  await page.locator('text=/LLEGADA/i').first().click()
  await page.waitForTimeout(700)

  await pickDay(page, 40)
  await pickDay(page, 41)
  const [firstArrival] = await chosenDates(page)

  // Dentro de los dos meses que el calendario dibuja: mas alla no hay nodo que
  // clicar y la prueba mediria el limite de la vista, no la conducta.
  await pickDay(page, 50)

  const [arrival, departure] = await chosenDates(page)
  expect(departure, 'the old range should be gone').toBe(EMPTY)
  expect(arrival, 'and the arrival should move to the day just clicked').not.toBe(firstArrival)
})

/**
 * The phone layout.
 *
 * A single month inside a popover, at cells barely wider than a fingertip,
 * asked a guest comparing two weekends to remember the first one. On a phone
 * the calendar takes the screen instead: months stacked and scrolled, each grid
 * spanning both edges.
 */
test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('fills the screen and stacks the months', async ({ page }) => {
    await page.locator('text=/LLEGADA/i').first().click()
    await page.waitForTimeout(1000)

    const layout = await page.evaluate(() => {
      const grid = document.querySelector('table')?.getBoundingClientRect()
      const cell = document.querySelector('button[data-day]')?.getBoundingClientRect()
      return {
        months: document.querySelectorAll('table').length,
        gridWidth: grid ? Math.round(grid.width) : 0,
        cellWidth: cell ? Math.round(cell.width) : 0,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })

    // Several months, not one: the point of scrolling instead of paging.
    expect(layout.months).toBeGreaterThan(6)
    // Edge to edge bar the sheet's own padding. A `w-fit` calendar — the shared
    // component's default, and right inside a popover — sat in the middle of
    // the screen with the week squeezed into two thirds of it.
    expect(layout.gridWidth).toBeGreaterThan(340)
    // Seven equal columns of whatever is left.
    expect(Math.abs(layout.cellWidth - layout.gridWidth / 7)).toBeLessThan(2)
    expect(layout.overflow, 'la hoja no debe empujar la página a lo ancho').toBe(0)
  })

  test('picks a stay months ahead without paging', async ({ page }) => {
    await page.locator('text=/LLEGADA/i').first().click()
    await page.waitForTimeout(1000)

    await page.mouse.move(195, 500)
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, 700)
      await page.waitForTimeout(120)
    }
    await page.waitForTimeout(500)

    const days = page.locator('button[data-day]:not([disabled])')
    const start = Math.floor((await days.count()) * 0.55)
    for (const index of [start, start + 2]) {
      const day = days.nth(index)
      await day.scrollIntoViewIfNeeded()
      await day.hover()
      await page.waitForTimeout(150)
      await day.click()
      await page.waitForTimeout(350)
    }

    const [arrival, departure] = await chosenDates(page)
    expect(arrival).not.toBe(EMPTY)
    expect(departure).not.toBe(EMPTY)
  })
})
