import { CANCELLATION_RULES, type CancellationPolicy } from './cancellation'

/**
 * What a cancelled stay gets back.
 *
 * This proposes; it never moves money. The panel shows every line of the
 * proposal and the host confirms or overrides the figure — a refund is a
 * decision, and the one person who knows whether the week can be resold is not
 * a function.
 *
 * The ladder itself is `CANCELLATION_RULES`; what this adds is which parts of
 * the bill the ladder applies to.
 */

/** The bill as it was charged, in dollars. Mirrors the Booking columns. */
export interface RefundBasis {
  nightsSubtotal: number
  weeklyDiscount: number
  additionalGuestFee: number
  cleaningFee: number
  serviceFee: number
  extrasTotal: number
  taxes: number
}

/** Which rung of the ladder decided the figure. */
export type RefundReason = 'GRACE' | 'FULL' | 'HALF' | 'NONE' | 'STAY_STARTED'

export interface RefundProposal {
  /** Share of the accommodation the policy returns: 1, 0.5 or 0. */
  rate: number
  accommodation: number
  serviceFee: number
  cleaningFee: number
  extras: number
  taxes: number
  total: number
  reason: RefundReason
  /** Whole days between the cancellation and the check-in day. */
  daysBeforeCheckIn: number
}

const cents = (amount: number) => Math.round(amount * 100)
const dollars = (amount: number) => Math.round(amount) / 100

/**
 * Whole days from `now` to the start of the check-in day, in UTC.
 *
 * Check-in is a date, not an instant: cancelling at any hour of the day before
 * arrival is one day before, not zero-point-something.
 */
export function daysUntilCheckIn(checkIn: string, now: Date): number {
  const arrival = Date.parse(`${checkIn}T00:00:00Z`)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((arrival - today) / 86_400_000)
}

export function proposeRefund(input: {
  checkIn: string
  /** When the booking was made, for the policies that have a grace window. */
  bookedAt: Date
  policy: CancellationPolicy
  basis: RefundBasis
  now?: Date
}): RefundProposal {
  const now = input.now ?? new Date()
  const rule = CANCELLATION_RULES[input.policy]
  const daysBefore = daysUntilCheckIn(input.checkIn, now)

  // Nothing is proposed once the stay has begun. The night was held, the house
  // was ready, and whether anything goes back is a conversation rather than a
  // rung on a ladder.
  if (daysBefore <= 0) {
    return {
      rate: 0,
      accommodation: 0,
      serviceFee: 0,
      cleaningFee: 0,
      extras: 0,
      taxes: 0,
      total: 0,
      reason: 'STAY_STARTED',
      daysBeforeCheckIn: daysBefore,
    }
  }

  const withinGrace =
    rule.graceHours !== undefined &&
    rule.graceRequiresDaysAhead !== undefined &&
    now.getTime() - input.bookedAt.getTime() <= rule.graceHours * 3_600_000 &&
    daysBefore >= rule.graceRequiresDaysAhead

  let rate = 0
  let reason: RefundReason = 'NONE'

  if (withinGrace) {
    rate = 1
    reason = 'GRACE'
  } else if (rule.fullRefundDaysBefore > 0 && daysBefore >= rule.fullRefundDaysBefore) {
    rate = 1
    reason = 'FULL'
  } else if (rule.halfRefundDaysBefore !== undefined && daysBefore >= rule.halfRefundDaysBefore) {
    rate = 0.5
    reason = 'HALF'
  }

  // What the nights themselves cost. The same figure the tax and the service
  // fee were computed from in `computeQuote`, so applying one rate to all three
  // keeps them consistent with each other.
  const accommodationCharged =
    cents(input.basis.nightsSubtotal) -
    cents(input.basis.weeklyDiscount) +
    cents(input.basis.additionalGuestFee)

  const accommodation = Math.round(accommodationCharged * rate)
  const serviceFee = Math.round(cents(input.basis.serviceFee) * rate)
  // Tax follows the money the host keeps. Nothing is owed on an amount that
  // was handed back.
  const taxes = Math.round(cents(input.basis.taxes) * rate)

  // Returned whole whenever the guest never arrives, whatever the ladder says:
  // nobody cleaned the house and nobody delivered the extra. This is the one
  // place where a 0 % policy still hands money back, and it is deliberate.
  const cleaningFee = cents(input.basis.cleaningFee)
  const extras = cents(input.basis.extrasTotal)

  const total = accommodation + serviceFee + taxes + cleaningFee + extras

  return {
    rate,
    accommodation: dollars(accommodation),
    serviceFee: dollars(serviceFee),
    cleaningFee: dollars(cleaningFee),
    extras: dollars(extras),
    taxes: dollars(taxes),
    total: dollars(total),
    reason,
    daysBeforeCheckIn: daysBefore,
  }
}
