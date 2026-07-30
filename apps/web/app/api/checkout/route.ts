import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { HOLD_TTL_MINUTES } from '@areia-bela/shared'
import { PROPERTY_SLUG } from '@/lib/property-data'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface GuestDetails {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  country?: string
}

interface CheckoutBody {
  checkIn?: string
  checkOut?: string
  guests?: { adults?: number; children?: number; infants?: number; pets?: number }
  guest?: GuestDetails
  extraIds?: string[]
  extraUnits?: Record<string, number>
  specialRequests?: string
  locale?: string
}

interface HoldResult {
  bookingId: string
  reference: string
  expiresAt: string
  quote: { nights: number; total: number }
}

/**
 * Holds the dates, then opens Stripe for them.
 *
 * Two things this route deliberately does not do.
 *
 * It does not take the amount from the request. It used to charge
 * `bookingDetails.totalPrice` exactly as the browser sent it, so `?total=1`
 * paid a dollar for a week (changelog §21). The API prices the stay and
 * returns the figure; Stripe is charged that.
 *
 * It does not create the booking. The row it gets back is a *hold* — pending,
 * with an expiry. Only Stripe's signed webhook can turn it into a confirmed
 * stay, because the success redirect is just a URL the guest's browser visits.
 */
export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    // Loud, rather than a confusing Stripe error further down.
    return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 })
  }

  try {
    const body = (await req.json()) as CheckoutBody
    const { checkIn, checkOut, guest } = body

    if (!checkIn || !checkOut || !ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut)) {
      return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
    }
    if (!guest?.firstName || !guest.lastName || !guest.email) {
      return NextResponse.json({ error: 'Missing guest details' }, { status: 400 })
    }

    const guests = body.guests ?? {}
    const adults = Math.max(1, Number(guests.adults) || 1)
    const children = Math.max(0, Number(guests.children) || 0)
    const infants = Math.max(0, Number(guests.infants) || 0)
    const pets = Math.max(0, Number(guests.pets) || 0)

    const holdResponse = await fetch(`${API_URL}/bookings/${PROPERTY_SLUG}/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkIn,
        checkOut,
        guests: { adults, children, infants, pets },
        guest: {
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: guest.phone ?? '',
          country: guest.country ?? '',
        },
        extraIds: Array.isArray(body.extraIds) ? body.extraIds : [],
        extraUnits: body.extraUnits ?? {},
        specialRequests: body.specialRequests,
        locale: body.locale,
      }),
      cache: 'no-store',
    })

    if (holdResponse.status === 409) {
      // Someone paid for these dates first. The guest can act on this one.
      return NextResponse.json({ error: 'Those dates were just taken' }, { status: 409 })
    }
    if (!holdResponse.ok) {
      // Refusing to charge beats guessing a price or double-booking a week.
      return NextResponse.json({ error: 'Could not hold these dates' }, { status: 502 })
    }

    const hold = (await holdResponse.json()) as HoldResult
    if (!(hold.quote.total > 0) || !hold.bookingId) {
      return NextResponse.json({ error: 'Could not price this stay' }, { status: 502 })
    }

    const partySize = adults + children
    // Stripe rejects a relative return URL, and `origin` is absent on requests
    // that aren't browser CORS calls. Fall back to where this route is served.
    const origin = req.headers.get('origin') || new URL(req.url).origin
    const stripe = new Stripe(secretKey)

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Areia Bela — ${hold.quote.nights} ${hold.quote.nights === 1 ? 'night' : 'nights'}`,
              description: `Whole house, ${checkIn} to ${checkOut}`,
            },
            unit_amount: Math.round(hold.quote.total * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: guest.email,
      // The session dies with the hold. Otherwise Stripe would keep taking
      // payments for a week the calendar had already released.
      expires_at: Math.floor(Date.now() / 1000) + HOLD_TTL_MINUTES * 60,
      success_url: `${origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?checkin=${checkIn}&checkout=${checkOut}&adults=${partySize}`,
      // The webhook needs exactly one thing: which hold this paid for.
      // Everything else about the stay is already a row in the database, where
      // it cannot be edited by whoever holds the session.
      metadata: { bookingId: hold.bookingId, reference: hold.reference },
    })

    return NextResponse.json({ id: session.id, url: session.url, reference: hold.reference })
  } catch (err) {
    console.error('Stripe error:', err)
    // Deliberately not echoing the Stripe message: it can name internal
    // configuration, and the guest can do nothing with it either way.
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 500 })
  }
}
