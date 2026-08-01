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

  /**
   * What Stripe says about a session, or null when it cannot be asked.
   *
   * Used when a guest comes back from paying and no webhook has arrived yet.
   * Asking on demand takes the webhook out of the critical path for the one
   * moment the guest is actually waiting — the background reconciliation still
   * covers everyone who closed the tab.
   */
  async sessionStatus(sessionId: string): Promise<{
    paid: boolean
    bookingId?: string
    amountTotal: number
    paymentIntentId?: string
  } | null> {
    if (!this.configured) return null

    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId)
      return {
        paid: session.payment_status === 'paid',
        bookingId: session.metadata?.bookingId ?? undefined,
        amountTotal: session.amount_total ?? 0,
        paymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? undefined),
      }
    } catch (error) {
      // An unknown id is the ordinary case here — someone opening the
      // confirmation URL with junk in it — so this is not an error worth
      // shouting about.
      this.logger.log(
        `Could not read session ${sessionId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      )
      return null
    }
  }

  /**
   * Sends money back for a charge that already went through.
   *
   * Deliberately not idempotent-by-guess: the caller writes a Refund row first
   * and passes its id, so a retry that reaches Stripe twice is refused by
   * Stripe rather than paying the guest twice. `amountCents` is always
   * explicit — Stripe's default is the full charge, and defaulting to "all of
   * it" is not a default worth having when the difference is real money.
   */
  async refund(request: {
    paymentIntentId: string
    amountCents: number
    /** The Refund row's id, used as Stripe's idempotency key. */
    idempotencyKey: string
  }): Promise<{ id: string; status: string }> {
    if (!this.configured) {
      this.logger.error('STRIPE_SECRET_KEY is not set; cannot refund')
      throw new ServiceUnavailableException('Payments are not configured')
    }

    const refund = await this.stripe.refunds.create(
      {
        payment_intent: request.paymentIntentId,
        amount: request.amountCents,
        // Not `duplicate` or `fraudulent`: those two feed Stripe's risk
        // signals, and a guest who cancelled a holiday is neither.
        reason: 'requested_by_customer',
      },
      { idempotencyKey: request.idempotencyKey },
    )

    return { id: refund.id, status: refund.status ?? 'unknown' }
  }

  /** The PaymentIntent behind a session, for bookings paid before we stored it. */
  async paymentIntentFor(sessionId: string): Promise<string | null> {
    const status = await this.sessionStatus(sessionId)
    return status?.paymentIntentId ?? null
  }
}
