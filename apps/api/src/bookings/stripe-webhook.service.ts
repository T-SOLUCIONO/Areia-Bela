import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'
import { BookingsService } from './bookings.service'

/**
 * Turns a Stripe event into a confirmed or released booking.
 *
 * Signature verification is the whole point of this class. Without it the
 * endpoint is "anyone who knows the URL can confirm a booking they did not pay
 * for", which is worse than having no webhook at all.
 */
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name)
  private readonly stripe: Stripe

  constructor(
    private readonly config: ConfigService,
    private readonly bookings: BookingsService,
  ) {
    // Signature verification is pure crypto over the webhook secret and never
    // calls Stripe, so an absent API key is not a reason to fail construction.
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY') ?? 'unused')
  }

  async handle(rawBody: Buffer, signature: string): Promise<void> {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')
    if (!secret) {
      // Refusing beats accepting unverified events: an unconfigured webhook
      // that confirms bookings is a free-stay endpoint.
      this.logger.error('STRIPE_WEBHOOK_SECRET is not set; refusing the event')
      throw new BadRequestException('Webhook not configured')
    }

    let event: Stripe.Event
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret)
    } catch (error) {
      this.logger.warn(`Rejected a webhook: ${error instanceof Error ? error.message : 'unknown'}`)
      throw new BadRequestException('Invalid signature')
    }

    const session = event.data.object as Stripe.Checkout.Session
    const bookingId = session.metadata?.bookingId

    switch (event.type) {
      case 'checkout.session.completed': {
        if (!bookingId) {
          this.logger.error(`Paid session ${session.id} carries no bookingId`)
          return
        }
        // amount_total comes from the signed payload, not from the browser.
        await this.bookings.confirmPayment(
          bookingId,
          session.id,
          session.amount_total ?? 0,
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? undefined),
        )
        break
      }

      case 'checkout.session.expired': {
        // The guest opened checkout and walked away. Their week goes back on
        // sale without waiting for the hold to time out.
        if (bookingId) await this.bookings.releaseHold(bookingId, 'El huésped no completó el pago')
        break
      }

      default:
        // Stripe sends plenty we did not subscribe to. Acknowledged, ignored.
        this.logger.debug(`Ignoring ${event.type}`)
    }
  }
}
