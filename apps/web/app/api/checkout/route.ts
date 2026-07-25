import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  try {
    const { bookingDetails } = await req.json()

    // Create Checkout Sessions from body params.
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${bookingDetails.roomName} - ${bookingDetails.nights} nights`,
              description: `Stay from ${bookingDetails.checkIn} to ${bookingDetails.checkOut}`,
            },
            unit_amount: Math.round(bookingDetails.totalPrice * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/checkout?roomId=${bookingDetails.roomId}&checkIn=${bookingDetails.checkIn}&checkOut=${bookingDetails.checkOut}&guests=${bookingDetails.guests}`,
      metadata: {
        roomId: bookingDetails.roomId,
        checkIn: bookingDetails.checkIn,
        checkOut: bookingDetails.checkOut,
        guests: bookingDetails.guests.toString(),
      },
    })

    return NextResponse.json({ id: session.id, url: session.url })
  } catch (err) {
    console.error('Stripe error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
