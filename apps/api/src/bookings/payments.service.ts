import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'
import { HOLD_TTL_MINUTES } from '@areia-bela/shared'

export interface CheckoutRequest {
  bookingId: string
  reference: string
  email: string
  /** The guest's own Stripe customer, so their payments group under one person. */
  stripeCustomerId?: string
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
      // The guest's own customer when we have one, and only the email as a
      // fallback.
      //
      // `customer_email` alone attaches the payment to nobody — Stripe invents
      // a Dashboard-only "guest" grouping to display it. `customer_creation:
      // 'always'` is worse: it mints a brand new customer per checkout, because
      // Stripe never deduplicates by email, so three stays become three
      // customers. Passing the id keeps one guest as one person.
      ...(request.stripeCustomerId
        ? { customer: request.stripeCustomerId }
        : { customer_email: request.email }),
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
  }): Promise<{
    id: string
    status: string
    /** `reversal`, `refund` or `pending` — see `settlesAs` on the Refund row. */
    settlesAs?: string
    /** The acquirer reference number, when Stripe already has one. */
    cardReference?: string
  }> {
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

    const card = refund.destination_details?.card

    return {
      id: refund.id,
      status: refund.status ?? 'unknown',
      settlesAs: card?.type,
      // Only when Stripe says it is usable. A reference it calls `pending` is
      // one the guest's bank cannot look up yet, so handing it over would send
      // them to a dead end.
      cardReference: card?.reference_status === 'available' ? card.reference : undefined,
    }
  }

  /**
   * What Stripe says about a refund now.
   *
   * The acquirer reference number is rarely ready when the refund is created —
   * Stripe fills it in minutes later. Asking on demand is the same choice made
   * for payments in §41: a webhook that never arrives must not be the only way
   * to learn something.
   */
  async refundStatus(refundId: string): Promise<{
    status: string
    settlesAs?: string
    cardReference?: string
  } | null> {
    if (!this.configured) return null

    try {
      const refund = await this.stripe.refunds.retrieve(refundId)
      const card = refund.destination_details?.card

      return {
        status: refund.status ?? 'unknown',
        settlesAs: card?.type,
        cardReference: card?.reference_status === 'available' ? card.reference : undefined,
      }
    } catch (error) {
      this.logger.log(
        `Could not read refund ${refundId}: ${error instanceof Error ? error.message : 'unknown'}`,
      )
      return null
    }
  }

  /**
   * Every movement of money in a window, as Stripe's ledger has it.
   *
   * Balance transactions rather than charges: only these carry the fee and the
   * net, and only these show the charge in the currency the account actually
   * settles in. A panel built on charge amounts would report money the host
   * never receives.
   */
  async balanceTransactions(range: { from: Date; to: Date }): Promise<Stripe.BalanceTransaction[]> {
    if (!this.configured) return []

    const collected: Stripe.BalanceTransaction[] = []
    // `autoPagingToArray` needs a ceiling; a year of one house is nowhere near
    // it, and stopping is better than looping for ever on a bad range.
    const page = this.stripe.balanceTransactions.list({
      created: {
        gte: Math.floor(range.from.getTime() / 1000),
        lte: Math.floor(range.to.getTime() / 1000),
      },
      limit: 100,
      // The original charge or refund, which is what ties a row to a booking.
      expand: ['data.source'],
    })

    for await (const transaction of page) {
      collected.push(transaction)
      if (collected.length >= 1000) break
    }
    return collected
  }

  /** When money actually left Stripe for the bank. */
  async payouts(range: { from: Date; to: Date }): Promise<Stripe.Payout[]> {
    if (!this.configured) return []

    const result = await this.stripe.payouts.list({
      created: {
        gte: Math.floor(range.from.getTime() / 1000),
        lte: Math.floor(range.to.getTime() / 1000),
      },
      limit: 100,
    })
    return result.data
  }

  /**
   * The account itself, which is the only authority on what it settles in.
   *
   * Not the balance: a balance keeps old currencies around long after the
   * account stopped using them. Reading the settlement currency off the first
   * balance entry said EUR for an account that had already moved to USD.
   */
  async account(): Promise<{ country: string | null; defaultCurrency: string } | null> {
    if (!this.configured) return null

    try {
      const account = await this.stripe.accounts.retrieve()
      return {
        country: account.country ?? null,
        defaultCurrency: account.default_currency ?? 'usd',
      }
    } catch (error) {
      this.logger.log(
        `Could not read the account: ${error instanceof Error ? error.message : 'unknown'}`,
      )
      return null
    }
  }

  /** What is sitting in Stripe right now, waiting to be paid out. */
  async balance(): Promise<Stripe.Balance | null> {
    if (!this.configured) return null
    return this.stripe.balance.retrieve()
  }

  /**
   * The Stripe customer for a guest, created once and reused.
   *
   * Returns null rather than throwing: a booking must not fail because Stripe
   * would not make a customer record. The payment still goes through, it just
   * lands unattached — which is where everything already was.
   */
  async ensureCustomer(guest: {
    email: string
    name: string
    phone?: string
  }): Promise<string | null> {
    if (!this.configured) return null

    try {
      // Reuse before creating. Stripe will happily make a second record for an
      // address it already has — including one the host typed by hand in the
      // Dashboard — and duplicating a person is the thing this whole change
      // exists to stop.
      const existing = await this.stripe.customers.list({ email: guest.email, limit: 1 })
      if (existing.data[0]) return existing.data[0].id

      const customer = await this.stripe.customers.create({
        email: guest.email,
        name: guest.name,
        ...(guest.phone ? { phone: guest.phone } : {}),
      })
      return customer.id
    } catch (error) {
      this.logger.warn(
        `Could not create a Stripe customer for ${guest.email}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      )
      return null
    }
  }

  /**
   * The customer records Stripe holds.
   *
   * Account-wide rather than for a window: a customer is not an event, and
   * filtering people by a date range would answer a question nobody asked.
   */
  async customers(limit = 100): Promise<Stripe.Customer[]> {
    if (!this.configured) return []

    try {
      const result = await this.stripe.customers.list({ limit })
      return result.data
    } catch (error) {
      this.logger.log(
        `Could not list customers: ${error instanceof Error ? error.message : 'unknown'}`,
      )
      return []
    }
  }

  /**
   * Chargebacks.
   *
   * The one event that takes money back without asking: the guest's bank pulls
   * the charge and Stripe adds a fee on top. There is a deadline to respond, so
   * this belongs on a screen rather than in an email nobody opened.
   */
  async disputes(range: { from: Date; to: Date }): Promise<Stripe.Dispute[]> {
    if (!this.configured) return []

    try {
      const result = await this.stripe.disputes.list({
        created: {
          gte: Math.floor(range.from.getTime() / 1000),
          lte: Math.floor(range.to.getTime() / 1000),
        },
        limit: 50,
      })
      return result.data
    } catch (error) {
      this.logger.log(
        `Could not list disputes: ${error instanceof Error ? error.message : 'unknown'}`,
      )
      return []
    }
  }

  /** The PaymentIntent behind a session, for bookings paid before we stored it. */
  async paymentIntentFor(sessionId: string): Promise<string | null> {
    const status = await this.sessionStatus(sessionId)
    return status?.paymentIntentId ?? null
  }
}
