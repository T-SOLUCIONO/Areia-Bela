/**
 * The cancellation ladder, in Airbnb's shape because that is the vocabulary
 * guests already understand from booking elsewhere.
 *
 * Rules only — no prose. The wording lives in the site's translations, so the
 * same policy reads naturally in five languages instead of one translated
 * badly. What is encoded here is what actually decides a refund.
 */
export type CancellationPolicy = 'FLEXIBLE' | 'MODERATE' | 'FIRM' | 'STRICT'

export interface CancellationRule {
  /** Days before check-in up to which the guest gets everything back. */
  fullRefundDaysBefore: number
  /** Days before check-in for a half refund, when the policy has that step. */
  halfRefundDaysBefore?: number
  /**
   * Hours after booking during which it can always be cancelled in full.
   * Only STRICT has one, and only when the stay is far enough away.
   */
  graceHours?: number
  graceRequiresDaysAhead?: number
}

export const CANCELLATION_RULES: Record<CancellationPolicy, CancellationRule> = {
  FLEXIBLE: { fullRefundDaysBefore: 1 },
  MODERATE: { fullRefundDaysBefore: 5 },
  FIRM: { fullRefundDaysBefore: 30, halfRefundDaysBefore: 7 },
  STRICT: {
    fullRefundDaysBefore: 0,
    halfRefundDaysBefore: 7,
    graceHours: 48,
    graceRequiresDaysAhead: 14,
  },
}

/** The last day a full refund is possible, as an ISO date. */
export function fullRefundDeadline(checkIn: string, policy: CancellationPolicy): string | null {
  const { fullRefundDaysBefore } = CANCELLATION_RULES[policy]
  if (fullRefundDaysBefore <= 0) return null

  const date = new Date(`${checkIn}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - fullRefundDaysBefore)
  return date.toISOString().slice(0, 10)
}

/** The last day a half refund is possible, when the policy has that step. */
export function halfRefundDeadline(checkIn: string, policy: CancellationPolicy): string | null {
  const { halfRefundDaysBefore } = CANCELLATION_RULES[policy]
  if (!halfRefundDaysBefore) return null

  const date = new Date(`${checkIn}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - halfRefundDaysBefore)
  return date.toISOString().slice(0, 10)
}
