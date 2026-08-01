import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { proposeRefund, type RefundProposal } from '@areia-bela/shared'
import type { CancellationPolicy } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { PaymentsService } from './payments.service'

export interface RefundView {
  id: string
  amount: number
  proposedAmount: number
  reason: string
  note: string | null
  status: string
  failureReason: string | null
  /** How it settles, which is what decides the wait the guest is quoted. */
  settlesAs: string | null
  cardReference: string | null
  createdAt: string
}

export interface RefundSummary {
  reference: string
  total: number
  paidAt: string | null
  /** What has already gone back, counting refunds still in flight. */
  refunded: number
  /** The most that could still be sent. */
  refundable: number
  policy: CancellationPolicy
  proposal: RefundProposal
  history: RefundView[]
  /** Why no refund can be issued right now, if that is the case. */
  blockedReason: 'NOT_PAID' | 'NOTHING_LEFT' | null
}

/**
 * Money going back out.
 *
 * The ladder in `@areia-bela/shared` proposes a figure; this decides nothing on
 * its own. Every refund is written to the ledger before Stripe is called, so a
 * request that dies halfway leaves a row saying so rather than a silence.
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** What the panel shows before anyone clicks anything. */
  async summaryFor(bookingId: string): Promise<RefundSummary> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: { select: { cancellationPolicy: true } },
        refunds: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!booking) throw new NotFoundException('Booking not found')

    // A refund that failed freed its money again; one still pending has not
    // left yet but must not be promised twice.
    const committed = booking.refunds.filter((refund) => refund.status !== 'FAILED')
    const refunded = committed.reduce((sum, refund) => sum + Number(refund.amount), 0)
    const total = Number(booking.totalPrice)
    const refundable = Math.max(0, Math.round((total - refunded) * 100) / 100)

    const proposal = proposeRefund({
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      bookedAt: booking.createdAt,
      policy: booking.property.cancellationPolicy,
      basis: {
        nightsSubtotal: Number(booking.nightsSubtotal),
        weeklyDiscount: Number(booking.weeklyDiscount),
        additionalGuestFee: Number(booking.additionalGuestFee),
        cleaningFee: Number(booking.cleaningFee),
        serviceFee: Number(booking.serviceFee),
        extrasTotal: Number(booking.extrasTotal),
        taxes: Number(booking.taxes),
      },
    })

    return {
      reference: booking.reference,
      total,
      paidAt: booking.paidAt?.toISOString() ?? null,
      refunded,
      refundable,
      policy: booking.property.cancellationPolicy,
      // Never propose more than is left to give, however the ladder came out.
      proposal: { ...proposal, total: Math.min(proposal.total, refundable) },
      // Failed attempts included: the host needs to see that one was tried.
      history: booking.refunds.map(view),
      blockedReason: !booking.paidAt ? 'NOT_PAID' : refundable <= 0 ? 'NOTHING_LEFT' : null,
    }
  }

  /**
   * Sends money back.
   *
   * `amount` is whatever the host confirmed, which is often but not always the
   * proposal — they are the one who knows whether the week can be resold.
   */
  async issue(
    bookingId: string,
    input: { amount: number; note?: string; userId?: string },
  ): Promise<RefundView> {
    const summary = await this.summaryFor(bookingId)

    if (summary.blockedReason === 'NOT_PAID') {
      throw new BadRequestException('This booking was never paid, so there is nothing to refund')
    }
    if (input.amount <= 0) {
      throw new BadRequestException('A refund has to be more than zero')
    }
    if (input.amount > summary.refundable) {
      throw new BadRequestException(`Only $${summary.refundable} is left to refund on this booking`)
    }

    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { customer: true },
    })

    // Stripe refunds a PaymentIntent. Bookings taken before Fase 7 have only a
    // session id, so it is fetched once and kept.
    let paymentIntentId = booking.stripePaymentIntentId
    if (!paymentIntentId && booking.stripeSessionId) {
      paymentIntentId = await this.payments.paymentIntentFor(booking.stripeSessionId)
      if (paymentIntentId) {
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: { stripePaymentIntentId: paymentIntentId },
        })
      }
    }
    if (!paymentIntentId) {
      throw new BadRequestException(
        'No Stripe payment is on file for this booking, so it cannot be refunded automatically',
      )
    }

    // The row exists before the money moves. Its id is the idempotency key, so
    // a retry of this request cannot pay the guest twice.
    const record = await this.prisma.refund.create({
      data: {
        bookingId,
        amount: input.amount,
        proposedAmount: summary.proposal.total,
        reason: summary.proposal.reason,
        note: input.note?.trim() || null,
        createdById: input.userId,
      },
    })

    try {
      const result = await this.payments.refund({
        paymentIntentId,
        amountCents: Math.round(input.amount * 100),
        idempotencyKey: record.id,
      })

      const saved = await this.prisma.refund.update({
        where: { id: record.id },
        // Stripe returns `pending` for methods that settle later. Only its own
        // `succeeded` is treated as done.
        data: {
          status: result.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING',
          stripeRefundId: result.id,
          settlesAs: result.settlesAs,
          cardReference: result.cardReference,
        },
      })

      this.logger.log(`Refunded $${input.amount} on ${booking.reference} (${result.id})`)

      const notice = {
        reference: booking.reference,
        guestName: `${booking.customer.firstName} ${booking.customer.lastName}`,
        guestEmail: booking.customer.email,
        locale: booking.locale,
        amount: input.amount,
        total: Number(booking.totalPrice),
        note: input.note?.trim() || undefined,
        settlesAs: result.settlesAs,
        cardReference: result.cardReference,
      }
      await this.notifications.refundIssued(notice)
      await this.notifications.refundSent(notice)

      return view(saved)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown'
      // The ledger keeps the attempt. A refund that Stripe refused is
      // something the host has to know about, not something to erase.
      await this.prisma.refund.update({
        where: { id: record.id },
        data: { status: 'FAILED', failureReason: message },
      })
      this.logger.error(`Refund on ${booking.reference} failed: ${message}`)
      throw new BadRequestException(`Stripe refused the refund: ${message}`)
    }
  }
}

function view(refund: {
  id: string
  amount: unknown
  proposedAmount: unknown
  reason: string
  note: string | null
  status: string
  failureReason: string | null
  settlesAs: string | null
  cardReference: string | null
  createdAt: Date
}): RefundView {
  return {
    id: refund.id,
    amount: Number(refund.amount),
    proposedAmount: Number(refund.proposedAmount),
    reason: refund.reason,
    note: refund.note,
    status: refund.status,
    failureReason: refund.failureReason,
    settlesAs: refund.settlesAs,
    cardReference: refund.cardReference,
    createdAt: refund.createdAt.toISOString(),
  }
}
