import { Injectable } from '@nestjs/common'
import type Stripe from 'stripe'
import { PrismaService } from '../prisma/prisma.service'
import { PaymentsService } from '../bookings/payments.service'

export interface LedgerRow {
  id: string
  /** `charge`, `refund`, `payout`, `stripe_fee`, `adjustment`… as Stripe names it. */
  type: string
  createdAt: string
  /** What the guest was charged, in the currency they saw. Null for rows with no source. */
  chargedAmount: number | null
  chargedCurrency: string | null
  /** The same money in the currency the account settles in. */
  settledAmount: number
  processingFee: number
  conversionFee: number
  otherFees: number
  net: number
  status: string
  /** The booking this belongs to, when it can be matched. */
  reference: string | null
  guestName: string | null
}

export interface PayoutRow {
  id: string
  amount: number
  status: string
  arrivesOn: string
  createdAt: string
}

export interface PaymentsReport {
  from: string
  to: string
  /** The currency the account settles in, which need not be the one guests pay in. */
  settlementCurrency: string
  /** True when guests are charged in a currency the account does not settle in. */
  convertsCurrency: boolean
  totals: {
    /** Gross taken from guests, in the currency they paid. */
    charged: number
    chargedCurrency: string
    refunded: number
    /** After conversion, before fees. */
    settled: number
    settledRefunded: number
    processingFees: number
    conversionFees: number
    otherFees: number
    /** What is actually left. */
    net: number
  }
  rows: LedgerRow[]
  payouts: PayoutRow[]
  /** What Stripe is holding right now, per currency. */
  balance: Array<{ currency: string; available: number; pending: number }>
  /** False when Stripe is not configured, so the panel can say so plainly. */
  connected: boolean
}

const money = (cents: number) => Math.round(cents) / 100

/**
 * The money, as Stripe's ledger has it rather than as our bookings imply.
 *
 * The two disagree, and the difference is not rounding. This house prices in
 * USD and the Stripe account settles in EUR, so every booking goes through a
 * conversion and a fee before anything reaches the bank. A panel that added up
 * `Booking.totalPrice` would report a number the host never receives.
 */
@Injectable()
export class PaymentsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async report(range: { from: Date; to: Date }): Promise<PaymentsReport> {
    const [transactions, payouts, balance] = await Promise.all([
      this.payments.balanceTransactions(range),
      this.payments.payouts(range),
      this.payments.balance(),
    ])

    const rows = await this.withBookings(transactions)

    const totals = {
      charged: 0,
      chargedCurrency: '',
      refunded: 0,
      settled: 0,
      settledRefunded: 0,
      processingFees: 0,
      conversionFees: 0,
      otherFees: 0,
      net: 0,
    }

    for (const row of rows) {
      if (row.type === 'charge' && row.chargedAmount !== null) {
        totals.charged += row.chargedAmount
        totals.settled += row.settledAmount
        totals.chargedCurrency ||= row.chargedCurrency ?? ''
      }
      if (row.type === 'refund' && row.chargedAmount !== null) {
        // Stripe signs a refund negative. The host reads "refunded: 2490", not
        // "refunded: -2490", so it is flipped here and never added blindly.
        totals.refunded += Math.abs(row.chargedAmount)
        totals.settledRefunded += Math.abs(row.settledAmount)
        totals.chargedCurrency ||= row.chargedCurrency ?? ''
      }
      totals.processingFees += row.processingFee
      totals.conversionFees += row.conversionFee
      totals.otherFees += row.otherFees
      // Payout rows are money moving to the bank, not income: counting them
      // would subtract the same euros twice.
      if (row.type !== 'payout') totals.net += row.net
    }

    const settlementCurrency = balance?.available[0]?.currency ?? 'eur'

    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      settlementCurrency,
      convertsCurrency:
        totals.chargedCurrency !== '' && totals.chargedCurrency !== settlementCurrency,
      totals: { ...totals, chargedCurrency: totals.chargedCurrency || settlementCurrency },
      rows,
      payouts: payouts.map((payout) => ({
        id: payout.id,
        amount: money(payout.amount),
        status: payout.status,
        arrivesOn: new Date(payout.arrival_date * 1000).toISOString(),
        createdAt: new Date(payout.created * 1000).toISOString(),
      })),
      balance:
        balance?.available.map((entry, index) => ({
          currency: entry.currency,
          available: money(entry.amount),
          pending: money(balance.pending[index]?.amount ?? 0),
        })) ?? [],
      connected: balance !== null,
    }
  }

  /**
   * Puts a guest's name on each row.
   *
   * Stripe knows amounts; it does not know that `pi_3Tz…` was the Hendersons'
   * week in August. Rows that cannot be matched keep a null rather than a
   * guess — a Stripe fee has no booking, and pretending otherwise would be
   * inventing.
   */
  private async withBookings(transactions: Stripe.BalanceTransaction[]): Promise<LedgerRow[]> {
    const paymentIntentIds: string[] = []
    const refundIds: string[] = []

    for (const transaction of transactions) {
      const source = transaction.source
      if (!source || typeof source === 'string') continue
      if (source.object === 'charge' && typeof source.payment_intent === 'string') {
        paymentIntentIds.push(source.payment_intent)
      }
      if (source.object === 'refund') refundIds.push(source.id)
    }

    const [bookings, refunds] = await Promise.all([
      paymentIntentIds.length
        ? this.prisma.booking.findMany({
            where: { stripePaymentIntentId: { in: paymentIntentIds } },
            select: {
              stripePaymentIntentId: true,
              reference: true,
              customer: { select: { firstName: true, lastName: true } },
            },
          })
        : [],
      refundIds.length
        ? this.prisma.refund.findMany({
            where: { stripeRefundId: { in: refundIds } },
            select: {
              stripeRefundId: true,
              booking: {
                select: {
                  reference: true,
                  customer: { select: { firstName: true, lastName: true } },
                },
              },
            },
          })
        : [],
    ])

    const byIntent = new Map(
      bookings.map((booking) => [
        booking.stripePaymentIntentId!,
        {
          reference: booking.reference,
          guestName: `${booking.customer.firstName} ${booking.customer.lastName}`,
        },
      ]),
    )
    const byRefund = new Map(
      refunds.map((refund) => [
        refund.stripeRefundId!,
        {
          reference: refund.booking.reference,
          guestName: `${refund.booking.customer.firstName} ${refund.booking.customer.lastName}`,
        },
      ]),
    )

    return transactions.map((transaction) => {
      const source = transaction.source
      const object = source && typeof source !== 'string' ? source : null

      let match: { reference: string; guestName: string } | undefined
      if (object?.object === 'charge' && typeof object.payment_intent === 'string') {
        match = byIntent.get(object.payment_intent)
      }
      if (object?.object === 'refund') match = byRefund.get(object.id)

      // Stripe names its fee components in prose. Matching on the words is
      // fragile, so anything unrecognised lands in `otherFees` and is still
      // counted rather than silently dropped.
      let processingFee = 0
      let conversionFee = 0
      let otherFees = 0
      for (const detail of transaction.fee_details) {
        const description = detail.description?.toLowerCase() ?? ''
        if (description.includes('conversion')) conversionFee += detail.amount
        else if (detail.type === 'stripe_fee') processingFee += detail.amount
        else otherFees += detail.amount
      }

      const chargedAmount =
        object && 'amount' in object && typeof object.amount === 'number' ? object.amount : null

      return {
        id: transaction.id,
        type: transaction.type,
        createdAt: new Date(transaction.created * 1000).toISOString(),
        // A refund's source carries a positive amount; the ledger row is what
        // says it went out, so the sign is taken from there.
        chargedAmount:
          chargedAmount === null
            ? null
            : money(transaction.amount < 0 ? -Math.abs(chargedAmount) : chargedAmount),
        chargedCurrency:
          object && 'currency' in object && typeof object.currency === 'string'
            ? object.currency
            : null,
        settledAmount: money(transaction.amount),
        processingFee: money(processingFee),
        conversionFee: money(conversionFee),
        otherFees: money(otherFees),
        net: money(transaction.net),
        status: transaction.status,
        reference: match?.reference ?? null,
        guestName: match?.guestName ?? null,
      }
    })
  }
}
