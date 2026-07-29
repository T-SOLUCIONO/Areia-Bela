import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { PROPERTY_SLUG } from '@/lib/property-data'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface CheckoutBody {
  checkIn?: string
  checkOut?: string
  guests?: { adults?: number; children?: number; infants?: number; pets?: number }
  extraIds?: string[]
  extraUnits?: Record<string, number>
}

interface QuoteBreakdown {
  nights: number
  total: number
}

/**
 * Creates the Stripe session for a stay.
 *
 * The amount is **not** taken from the request. This route used to charge
 * `bookingDetails.totalPrice` exactly as the browser sent it, so a hand-edited
 * query string was a working discount: `?total=1` paid a dollar for a week.
 *
 * Now the body carries only the stay's inputs, the API prices them, and Stripe
 * is charged that figure. CLAUDE.md: the price is always server-authoritative,
 * and the frontend never sends a total the backend accepts without recomputing.
 */
export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    // Loud, rather than a confusing Stripe error further down.
    return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 })
  }

  try {
    const body = (await req.json()) as CheckoutBody
    const { checkIn, checkOut } = body

    if (!checkIn || !checkOut || !ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut)) {
      return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
    }

    const extraIds = Array.isArray(body.extraIds) ? body.extraIds : []
    const guests = body.guests ?? {}

    const quoteResponse = await fetch(`${API_URL}/properties/${PROPERTY_SLUG}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkIn,
        checkOut,
        // The party size and the quantities change the total, so they have to
        // reach the pricing endpoint too — otherwise the guest sees one figure
        // and Stripe charges another.
        guests: {
          adults: Math.max(1, Number(guests.adults) || 1),
          children: Math.max(0, Number(guests.children) || 0),
          infants: Math.max(0, Number(guests.infants) || 0),
        },
        extraIds,
        extraUnits: body.extraUnits ?? {},
      }),
      cache: 'no-store',
    })

    if (!quoteResponse.ok) {
      // Refusing to charge beats guessing a price.
      return NextResponse.json({ error: 'Could not price this stay' }, { status: 502 })
    }

    const quote = (await quoteResponse.json()) as QuoteBreakdown
    if (!(quote.total > 0)) {
      return NextResponse.json({ error: 'Could not price this stay' }, { status: 502 })
    }

    const partySize =
      Math.max(1, Number(guests.adults) || 1) + Math.max(0, Number(guests.children) || 0)
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
              name: `Areia Bela — ${quote.nights} ${quote.nights === 1 ? 'night' : 'nights'}`,
              description: `Whole house, ${checkIn} to ${checkOut}`,
            },
            unit_amount: Math.round(quote.total * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?checkin=${checkIn}&checkout=${checkOut}&adults=${partySize}`,
      // What the booking was, for the Fase 7 webhook that creates the Booking
      // row. Stripe caps each metadata value at 500 characters.
      metadata: {
        propertySlug: PROPERTY_SLUG,
        checkIn,
        checkOut,
        nights: String(quote.nights),
        guests: String(partySize),
        infants: String(Math.max(0, Number(guests.infants) || 0)),
        pets: String(Math.max(0, Number(guests.pets) || 0)),
        extraIds: extraIds.join(',').slice(0, 500),
      },
    })

    return NextResponse.json({ id: session.id, url: session.url })
  } catch (err) {
    console.error('Stripe error:', err)
    // Deliberately not echoing the Stripe message: it can name internal
    // configuration, and the guest can do nothing with it either way.
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 500 })
  }
}
