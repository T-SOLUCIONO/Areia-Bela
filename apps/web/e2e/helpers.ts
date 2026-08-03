import { addDays, format } from 'date-fns'

export const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
export const PROPERTY = 'areia-bela'

/**
 * Dates far enough out that nothing real is there.
 *
 * The suite runs against the same database the panel does. Booking next week
 * would collide with whatever the host actually has, and worse, would look
 * like a real booking in her calendar.
 */
export function futureStay(offsetDays = 400, nights = 3) {
  const checkIn = addDays(new Date(), offsetDays)
  return {
    checkIn: format(checkIn, 'yyyy-MM-dd'),
    checkOut: format(addDays(checkIn, nights), 'yyyy-MM-dd'),
    nights,
  }
}

/** The checkout URL for a stay, as the quoter would build it. */
export function checkoutUrl(stay: { checkIn: string; checkOut: string }, locale = 'es') {
  const params = new URLSearchParams({
    checkin: stay.checkIn,
    checkout: stay.checkOut,
    adults: '2',
    children: '0',
    infants: '0',
    pets: '0',
    extras: '',
    units: '',
  })
  return `/${locale}/checkout?${params}`
}

/** A guest who is obviously a test, so a stray row is recognisable in the panel. */
export const TEST_GUEST = {
  firstName: 'E2E',
  lastName: 'Playwright',
  email: 'e2e-playwright@example.com',
  phone: '+13055550100',
  country: 'United States',
}
