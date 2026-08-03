import { BadRequestException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { RefundsService } from './refunds.service'
import type { PaymentsService } from './payments.service'
import type { NotificationsService } from '../notifications/notifications.service'
import type { PrismaService } from '../prisma/prisma.service'

/**
 * The guardrails around money leaving.
 *
 * The arithmetic is pinned in `refund.spec.ts`; what is asserted here is that
 * nothing sends more than it should, and that a refund Stripe refused leaves a
 * trace instead of vanishing.
 */

const PAID_BOOKING = {
  id: 'booking-1',
  reference: 'AB-XYZ123',
  locale: 'es',
  totalPrice: new Prisma.Decimal(1245),
  checkIn: new Date('2026-08-30T00:00:00Z'),
  createdAt: new Date('2026-06-01T10:00:00Z'),
  paidAt: new Date('2026-06-01T10:05:00Z') as Date | null,
  stripeSessionId: 'cs_test_1' as string | null,
  stripePaymentIntentId: 'pi_test_1' as string | null,
  nightsSubtotal: new Prisma.Decimal(900),
  weeklyDiscount: new Prisma.Decimal(0),
  additionalGuestFee: new Prisma.Decimal(0),
  cleaningFee: new Prisma.Decimal(120),
  serviceFee: new Prisma.Decimal(108),
  extrasTotal: new Prisma.Decimal(0),
  taxes: new Prisma.Decimal(117),
  property: { cancellationPolicy: 'MODERATE' as const },
  customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
  refunds: [] as ReturnType<typeof pastRefund>[],
}

/** A refund already on the ledger, shaped like the row Prisma returns. */
function pastRefund(amount: number, status: 'SUCCEEDED' | 'PENDING' | 'FAILED') {
  return {
    id: `refund-past-${amount}`,
    amount: new Prisma.Decimal(amount),
    proposedAmount: new Prisma.Decimal(amount),
    reason: 'FULL',
    note: null,
    status,
    failureReason: status === 'FAILED' ? 'card_declined' : null,
    stripeRefundId: status === 'FAILED' ? null : `re_${amount}`,
    // What Stripe had not handed over yet when the refund was created.
    settlesAs: null,
    cardReference: null,
    createdAt: new Date('2026-08-10T12:00:00Z'),
  }
}

function build(
  overrides: {
    booking?: Partial<typeof PAID_BOOKING>
    refundFails?: boolean
    /** Whether Stripe already has an acquirer reference to hand over. */
    referenceReady?: boolean
  } = {},
) {
  const booking = { ...PAID_BOOKING, ...overrides.booking }

  const refundRows: Array<Record<string, unknown>> = []
  const prisma = {
    booking: {
      findUnique: jest.fn().mockResolvedValue(booking),
      findUniqueOrThrow: jest.fn().mockResolvedValue(booking),
      update: jest.fn().mockResolvedValue(booking),
    },
    refund: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `refund-${refundRows.length + 1}`,
          note: null,
          failureReason: null,
          status: 'PENDING',
          createdAt: new Date('2026-08-20T12:00:00Z'),
          ...data,
        }
        refundRows.push(row)
        return Promise.resolve(row)
      }),
      update: jest
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            // Rows written by this test, plus the ones already on the booking:
            // catching up on Stripe updates the latter.
            const row = [...refundRows, ...booking.refunds].find(
              (candidate) => candidate.id === where.id,
            )
            Object.assign(row!, data)
            return Promise.resolve(row)
          },
        ),
    },
  } as unknown as PrismaService

  const payments = {
    refund: overrides.refundFails
      ? jest.fn().mockRejectedValue(new Error('charge already refunded'))
      : jest.fn().mockResolvedValue({ id: 're_test_1', status: 'succeeded' }),
    paymentIntentFor: jest.fn().mockResolvedValue('pi_from_session'),
    refundStatus: jest
      .fn()
      .mockResolvedValue(
        overrides.referenceReady === false
          ? { status: 'succeeded' }
          : { status: 'succeeded', settlesAs: 'refund', cardReference: '3977554206558176' },
      ),
  } as unknown as PaymentsService

  const notifications = {
    refundIssued: jest.fn().mockResolvedValue(undefined),
    refundSent: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService

  return {
    service: new RefundsService(prisma, payments, notifications),
    prisma,
    payments,
    notifications,
    refundRows,
  }
}

describe('RefundsService.summaryFor', () => {
  it('proposes the full bill five days out, under MODERATE', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-25T12:00:00Z'))
    const { service } = build()

    const summary = await service.summaryFor('booking-1')

    expect(summary.proposal.reason).toBe('FULL')
    expect(summary.proposal.total).toBe(1245)
    expect(summary.refundable).toBe(1245)
    expect(summary.blockedReason).toBeNull()
    jest.useRealTimers()
  })

  it('never proposes more than is left after an earlier refund', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-25T12:00:00Z'))
    const { service } = build({
      booking: { refunds: [pastRefund(1000, 'SUCCEEDED')] },
    })

    const summary = await service.summaryFor('booking-1')

    expect(summary.refunded).toBe(1000)
    expect(summary.refundable).toBe(245)
    // The ladder says 1245; there are 245 left.
    expect(summary.proposal.total).toBe(245)
    jest.useRealTimers()
  })

  it('gives a failed attempt its money back', async () => {
    const { service } = build({
      booking: { refunds: [pastRefund(1245, 'FAILED')] },
    })

    const summary = await service.summaryFor('booking-1')

    expect(summary.refunded).toBe(0)
    expect(summary.refundable).toBe(1245)
    // But it is still on the record.
    expect(summary.history).toHaveLength(1)
  })

  it('fills in the reference Stripe did not have when the refund was created', async () => {
    // Exactly what happened to the two real refunds: created with the ARN
    // still `pending`, so the row kept a null and the guest's email went out
    // without a trace number.
    const { service, payments, prisma } = build({
      booking: { refunds: [pastRefund(1245, 'SUCCEEDED')] },
    })

    const summary = await service.summaryFor('booking-1')

    expect(payments.refundStatus).toHaveBeenCalledWith('re_1245')
    expect(prisma.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cardReference: '3977554206558176' }),
      }),
    )
    // Visible on this very call, not only the next one.
    expect(summary.history[0].cardReference).toBe('3977554206558176')
  })

  it('leaves the row alone while Stripe still calls the reference pending', async () => {
    const { service, prisma } = build({
      booking: { refunds: [pastRefund(1245, 'SUCCEEDED')] },
      referenceReady: false,
    })

    await service.summaryFor('booking-1')

    expect(prisma.refund.update).not.toHaveBeenCalled()
  })

  it('does not ask Stripe about a refund that never reached it', async () => {
    const { service, payments } = build({
      booking: { refunds: [pastRefund(1245, 'FAILED')] },
    })

    await service.summaryFor('booking-1')

    expect(payments.refundStatus).not.toHaveBeenCalled()
  })

  it('says so when the booking was never paid', async () => {
    const { service } = build({ booking: { paidAt: null } })

    expect((await service.summaryFor('booking-1')).blockedReason).toBe('NOT_PAID')
  })
})

describe('RefundsService.issue', () => {
  it('writes the ledger row before calling Stripe', async () => {
    const { service, payments, refundRows } = build()

    await service.issue('booking-1', { amount: 500, userId: 'user-1' })

    expect(refundRows).toHaveLength(1)
    // The row's id is the idempotency key, so a retry cannot pay twice.
    expect(payments.refund).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'refund-1', amountCents: 50_000 }),
    )
    expect(refundRows[0].createdById).toBe('user-1')
  })

  it('refuses more than is left to refund', async () => {
    const { service, payments } = build({
      booking: { refunds: [pastRefund(1200, 'SUCCEEDED')] },
    })

    await expect(service.issue('booking-1', { amount: 100 })).rejects.toThrow(BadRequestException)
    expect(payments.refund).not.toHaveBeenCalled()
  })

  it('refuses to refund a booking that was never paid', async () => {
    const { service, payments } = build({ booking: { paidAt: null } })

    await expect(service.issue('booking-1', { amount: 10 })).rejects.toThrow(BadRequestException)
    expect(payments.refund).not.toHaveBeenCalled()
  })

  it('marks the row FAILED and keeps it when Stripe refuses', async () => {
    const { service, refundRows, notifications } = build({ refundFails: true })

    await expect(service.issue('booking-1', { amount: 100 })).rejects.toThrow(
      /Stripe refused the refund/,
    )

    expect(refundRows).toHaveLength(1)
    expect(refundRows[0].status).toBe('FAILED')
    expect(refundRows[0].failureReason).toBe('charge already refunded')
    // Nobody is told about money that did not move.
    expect(notifications.refundIssued).not.toHaveBeenCalled()
  })

  it('tells the guest only once the refund went through', async () => {
    const { service, notifications } = build()

    await service.issue('booking-1', { amount: 300, note: 'Se reservó la semana de nuevo' })

    expect(notifications.refundIssued).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 300, locale: 'es', reference: 'AB-XYZ123' }),
    )
    expect(notifications.refundSent).toHaveBeenCalled()
  })

  it('looks up the PaymentIntent for a booking taken before it was stored', async () => {
    const { service, payments } = build({ booking: { stripePaymentIntentId: null } })

    await service.issue('booking-1', { amount: 100 })

    expect(payments.paymentIntentFor).toHaveBeenCalledWith('cs_test_1')
    expect(payments.refund).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentId: 'pi_from_session' }),
    )
  })

  it('refuses when there is no Stripe payment on file at all', async () => {
    const { service, payments } = build({
      booking: { stripePaymentIntentId: null, stripeSessionId: null },
    })

    await expect(service.issue('booking-1', { amount: 100 })).rejects.toThrow(
      /No Stripe payment is on file/,
    )
    expect(payments.refund).not.toHaveBeenCalled()
  })

  it('refuses a zero or negative amount', async () => {
    const { service } = build()

    await expect(service.issue('booking-1', { amount: 0 })).rejects.toThrow(BadRequestException)
    await expect(service.issue('booking-1', { amount: -50 })).rejects.toThrow(BadRequestException)
  })
})
