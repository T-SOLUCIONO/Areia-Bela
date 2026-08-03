import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import Stripe from 'stripe'
import { PrismaService } from '../prisma/prisma.service'
import { BookingsService } from './bookings.service'

/** How far back to look. Longer than Stripe's own retry window, so nothing
 * falls between the two. */
const LOOKBACK_HOURS = 72

/**
 * Catches payments whose webhook never arrived.
 *
 * A webhook is a promise that someone else's network will reach yours, and it
 * is a promise that breaks: a tunnel renames itself in development, a deploy
 * takes the API down for forty seconds, DNS has a bad minute. Stripe retries,
 * but its retries also land on whatever was unreachable.
 *
 * So this asks the other way round: which sessions does Stripe say were paid,
 * and which of those has no confirmed booking here? Pull beats push for
 * catching up, and push beats pull for being quick — the two together are what
 * makes a paid stay reliably become a booking.
 *
 * Everything it finds goes through `confirmPayment`, the same idempotent path
 * the webhook uses. A booking already confirmed is left alone.
 */
@Injectable()
export class PaymentReconciliationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PaymentReconciliationService.name)
  private readonly stripe: Stripe
  private readonly configured: boolean

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY')
    this.configured = Boolean(key)
    this.stripe = new Stripe(key ?? 'unset')
  }

  /** On boot, because the likeliest gap is exactly while this was not running. */
  async onApplicationBootstrap(): Promise<void> {
    await this.reconcile()
    await this.backfillPaymentIntents()
  }

  /**
   * Puts a PaymentIntent on stays that were paid before we stored one.
   *
   * Two things need it. A refund goes against a PaymentIntent, so without it
   * the money can only be sent after an extra round trip to Stripe. And the
   * payments panel matches Stripe's ledger to bookings through exactly this
   * id — with it missing, every historical charge shows up as an unattributed
   * row with no guest name.
   *
   * Runs once per boot and does nothing on the second: the query only finds
   * rows that are still missing it.
   */
  private async backfillPaymentIntents(): Promise<void> {
    if (!this.configured) return

    const missing = await this.prisma.booking.findMany({
      where: {
        paidAt: { not: null },
        stripePaymentIntentId: null,
        stripeSessionId: { not: null },
      },
      select: { id: true, reference: true, stripeSessionId: true },
    })
    if (missing.length === 0) return

    let filled = 0
    for (const booking of missing) {
      try {
        const session = await this.stripe.checkout.sessions.retrieve(booking.stripeSessionId!)
        const intent =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id
        if (!intent) continue

        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { stripePaymentIntentId: intent },
        })
        filled += 1
      } catch (error) {
        // One unreadable session must not stop the rest. A booking that keeps
        // failing here simply stays unmatched in the panel.
        this.logger.warn(
          `Could not backfill ${booking.reference}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        )
      }
    }

    if (filled > 0) {
      this.logger.log(`Backfilled the PaymentIntent on ${filled} paid booking(s)`)
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcile(): Promise<void> {
    if (!this.configured) return

    // PENDING and CANCELLED, not just PENDING.
    //
    // A hold whose payment succeeded but whose webhook was lost expires like
    // any other and gets swept to CANCELLED — which is money taken with no
    // booking against it, the worst state this system has. Skipping cancelled
    // rows would have left exactly the case this job exists for.
    //
    // Never CONFIRMED: those have nothing to catch up on, and `confirmPayment`
    // ignores them anyway.
    const pending = await this.prisma.booking.findMany({
      where: {
        status: { in: ['PENDING', 'CANCELLED'] },
        paidAt: null,
        createdAt: { gte: new Date(Date.now() - LOOKBACK_HOURS * 3_600_000) },
      },
      select: { id: true, reference: true },
    })
    if (pending.length === 0) return

    let recovered = 0
    try {
      // One list call rather than one per booking: Stripe rate-limits, and a
      // busy week would otherwise mean dozens of round trips every ten minutes.
      const sessions = await this.stripe.checkout.sessions.list({
        limit: 100,
        created: { gte: Math.floor((Date.now() - LOOKBACK_HOURS * 3_600_000) / 1000) },
      })

      const waiting = new Map(pending.map((booking) => [booking.id, booking.reference]))

      for (const session of sessions.data) {
        const bookingId = session.metadata?.bookingId
        if (!bookingId || !waiting.has(bookingId)) continue
        if (session.payment_status !== 'paid') continue

        // confirmPayment decides what is possible: it restores a cancelled
        // hold when the dates are still free, and raises the "paid but
        // double-booked" alert when somebody else took them.
        this.logger.warn(
          `Recovering ${waiting.get(bookingId)}: paid on Stripe but no webhook arrived`,
        )
        await this.bookings.confirmPayment(
          bookingId,
          session.id,
          session.amount_total ?? 0,
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? undefined),
        )
        recovered += 1
      }
    } catch (error) {
      // Never throws: this runs on boot and on a timer, and a Stripe outage
      // must not stop the API from starting or keep the schedule from firing
      // again in ten minutes.
      this.logger.error(
        `Could not reconcile payments: ${error instanceof Error ? error.message : 'unknown'}`,
      )
      return
    }

    if (recovered > 0) {
      this.logger.warn(`Reconciled ${recovered} payment(s) whose webhook never arrived`)
    }
  }
}
