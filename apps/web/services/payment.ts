/**
 * The only payment call the site makes.
 *
 * There is no route handler behind it any more. `POST /bookings/:slug/hold`
 * prices the stay, takes the dates off the calendar and opens Stripe in one
 * call, so the frontend holds no Stripe credentials at all — it only follows
 * the URL it is handed.
 *
 * `createPaymentIntent`, `processBookingPayment`, `refundPayment` and
 * `getPaymentMethods` used to live here as simulations — one of them decided
 * whether a payment succeeded with `Math.random() > 0.05`. None had a caller.
 */
import { API_URL } from '@/lib/api-client'
import { PROPERTY_SLUG } from '@/lib/property-data'

export interface CheckoutSession {
  /** Stripe's hosted payment page. */
  url: string
  /** The booking reference the dates are held under. */
  reference: string
}

/**
 * What the browser is allowed to say about a booking: when, who, and which
 * extras. Never how much.
 *
 * The server prices these inputs and charges that. It used to accept
 * `totalPrice` from here and pass it straight to Stripe, which made the price
 * a suggestion from whoever had the page open (changelog §21).
 */
export interface CheckoutRequest {
  checkIn: string
  checkOut: string
  extraIds: string[]
  /** Units per extra — two dogs is two pet fees, and the server re-prices it. */
  extraUnits: Record<string, number>
  guests: { adults: number; children: number; infants: number; pets: number }
  /** Who the stay is for. The dates are held under this person's name. */
  guest: {
    firstName: string
    lastName: string
    email: string
    phone: string
    country: string
  }
  specialRequests?: string
  /** So the guest's confirmation email arrives in the language they booked in. */
  locale: string
}

/** The dates were taken while the guest was filling in the form. */
export class DatesUnavailableError extends Error {}

/** The stay is shorter or longer than the house accepts. */
export class StayLengthError extends Error {}

interface HoldResponse {
  reference: string
  checkoutUrl: string
}

export async function createCheckoutSession(booking: CheckoutRequest): Promise<CheckoutSession> {
  const response = await fetch(`${API_URL}/bookings/${PROPERTY_SLUG}/hold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests,
      guest: booking.guest,
      extraIds: booking.extraIds,
      extraUnits: booking.extraUnits,
      specialRequests: booking.specialRequests,
      locale: booking.locale,
    }),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null
    // 409 and 400 are the two the guest can act on: pick other dates, or pick
    // a different length. Everything else is ours to fix, and a specific
    // message would only send them in circles.
    if (response.status === 409) {
      throw new DatesUnavailableError(error?.message ?? 'Those dates were just taken')
    }
    if (response.status === 400) {
      throw new StayLengthError(error?.message ?? 'That stay length is not accepted')
    }
    throw new Error(error?.message ?? 'Failed to create checkout session')
  }

  const hold = (await response.json()) as HoldResponse
  return { url: hold.checkoutUrl, reference: hold.reference }
}
