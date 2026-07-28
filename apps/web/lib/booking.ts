import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { propertyData, PROPERTY_SLUG } from '@/lib/property-data'

export type GuestCounts = {
  adults: number
  children: number
  infants: number
  pets: number
}

export type PriceLine = { label: string; value: number }

export type BookingQuote = {
  checkIn: string
  checkOut: string
  nights: number
  guests: GuestCounts
  pricePerNight: number
  originalPricePerNight: number
  extras: Array<{ id: string; label: string; pricePerNight: number; total: number }>
  subtotal: number
  extrasTotal: number
  cleaningFee: number
  serviceFee: number
  taxes: number
  total: number
}

export const getNights = (checkIn: string, checkOut: string) =>
  Math.max(0, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)))

/** What the server needs to price a stay. Only inputs — never a total. */
export type QuoteRequest = {
  checkIn: string
  checkOut: string
  guests: GuestCounts
  selectedExtraIds: string[]
}

/**
 * Asks the API what the stay costs.
 *
 * The browser used to compute this from the bundled datos.json, which broke two
 * things at once: an edit to the cleaning fee in the admin never reached a
 * guest, and the total the guest saw was whatever their browser said it was.
 * CLAUDE.md is explicit that price is server-authoritative; this is that rule.
 */
export async function fetchQuote(input: QuoteRequest): Promise<BookingQuote | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl || !input.checkIn || !input.checkOut) return null

  try {
    const response = await fetch(`${apiUrl}/properties/${PROPERTY_SLUG}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        extraIds: input.selectedExtraIds,
      }),
    })
    if (!response.ok) return null

    const breakdown = (await response.json()) as Omit<
      BookingQuote,
      'checkIn' | 'checkOut' | 'guests' | 'originalPricePerNight'
    >

    return {
      ...breakdown,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      // Only used to draw a struck-through price; the server has no notion of
      // a "was" price, so it comes from the listing.
      originalPricePerNight: propertyData.pricing.original_price_per_night,
    }
  } catch {
    return null
  }
}

/**
 * Only the inputs travel to checkout. The priced breakdown used to ride along
 * in the query string, which meant `?total=1` was a valid way to pay one
 * dollar for a week: the Stripe route charged whatever arrived. Checkout now
 * re-asks the server for the price of these dates.
 */
export function serializeQuoteToSearchParams(quote: BookingQuote) {
  return new URLSearchParams({
    checkin: quote.checkIn,
    checkout: quote.checkOut,
    adults: String(quote.guests.adults),
    children: String(quote.guests.children),
    infants: String(quote.guests.infants),
    pets: String(quote.guests.pets),
    extras: quote.extras.map((extra) => extra.id).join(','),
  }).toString()
}

export function parseQuoteRequestFromSearchParams(
  searchParams: URLSearchParams,
): QuoteRequest | null {
  const checkIn = searchParams.get('checkin')
  const checkOut = searchParams.get('checkout')
  if (!checkIn || !checkOut) return null

  const count = (key: string) => Math.max(0, Number(searchParams.get(key)) || 0)

  return {
    checkIn,
    checkOut,
    guests: {
      adults: Math.max(1, count('adults')),
      children: count('children'),
      infants: count('infants'),
      pets: count('pets'),
    },
    selectedExtraIds: (searchParams.get('extras') ?? '').split(',').filter(Boolean),
  }
}

export async function getBlockedDateRanges(): Promise<Array<{ from: Date; to: Date }>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) return []

  try {
    const res = await fetch(`${apiUrl}/properties/${PROPERTY_SLUG}/blocked-dates`)
    if (!res.ok) return []

    const blockedDates = (await res.json()) as Array<{ startDate: string; endDate: string }>
    return blockedDates.map((blockedDate) => ({
      from: parseISO(blockedDate.startDate),
      to: parseISO(blockedDate.endDate),
    }))
  } catch {
    // Fail-soft: the calendar still works (just without excluding blocked
    // dates) if the API is unreachable.
    return []
  }
}

const BOOKING_QUOTE_STORAGE_KEY = 'booking_quote_v1'

export function saveQuoteToStorage(quote: BookingQuote) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BOOKING_QUOTE_STORAGE_KEY, JSON.stringify(quote))
}

export function getQuoteFromStorage(): BookingQuote | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(BOOKING_QUOTE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BookingQuote
    if (!parsed.checkIn || !parsed.checkOut || !parsed.nights) return null
    return parsed
  } catch {
    return null
  }
}

export const currency = (value: number) => `$${value.toLocaleString('en-US')}`
export const shortDate = (iso: string) => format(parseISO(iso), 'MMM d, yyyy')
