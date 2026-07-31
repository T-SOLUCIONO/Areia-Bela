import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'
import { HOLD_TTL_MINUTES } from '@areia-bela/shared'

export interface CheckoutRequest {
  bookingId: string
  reference: string
  email: string
  checkIn: string
  checkOut: string
  nights: number
  total: number
  guests: number
  /** Where the guest came from, for the return URLs. */
  origin: string
}

/**
 * Opens Stripe for a stay that is already held.
 *
 * This used to live in a Next route handler, which meant the Stripe secret key
 * sat in the frontend's environment. It was never exposed to a browser — route
 * handlers are server-side — but it split ownership of payments across two
 * apps, and the price, the booking and the webhook all live here. One place
 * owns Stripe now, and the frontend holds no Stripe credentials at all.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)
  private readonly stripe: Stripe
  private readonly configured: boolean

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY')
    this.configured = Boolean(key)
    this.stripe = new Stripe(key ?? 'unset')
  }

  async checkoutUrlFor(request: CheckoutRequest): Promise<string> {
    if (!this.configured) {
      // Loud and early, rather than a confusing Stripe error further down.
      this.logger.error('STRIPE_SECRET_KEY is not set; cannot open checkout')
      throw new ServiceUnavailableException('Payments are not configured')
    }

    const session = await this.stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Areia Bela — ${request.nights} ${request.nights === 1 ? 'night' : 'nights'}`,
              description: `Whole house, ${request.checkIn} to ${request.checkOut}`,
            },
            // The server's figure, in cents. Nothing from the browser reaches
            // this number: it was computed from the stay and stored on the
            // booking before this call.
            unit_amount: Math.round(request.total * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: request.email,
      // The session dies with the hold, or Stripe would keep taking payments
      // for a week the calendar had already released.
      expires_at: Math.floor(Date.now() / 1000) + HOLD_TTL_MINUTES * 60,
      success_url: `${request.origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.origin}/checkout?checkin=${request.checkIn}&checkout=${request.checkOut}&adults=${request.guests}`,
      // The webhook needs exactly one thing: which hold this paid for.
      // Everything else about the stay is already a row in the database, where
      // whoever holds the session cannot edit it.
      metadata: { bookingId: request.bookingId, reference: request.reference },
    })

    if (!session.url) {
      throw new ServiceUnavailableException('Stripe returned no checkout URL')
    }
    return session.url
  }
}
