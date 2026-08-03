import { proposeRefund, daysUntilCheckIn, type RefundBasis } from '@areia-bela/shared'

/**
 * The refund ladder, pinned.
 *
 * These figures decide how much money leaves the host's account, so every rung
 * is asserted rather than trusted: an off-by-one in `daysBefore` is the
 * difference between a full refund and none at all.
 */

// A real-shaped bill: 3 nights at $300, the cleaning and service fees the
// panel ships with, and Pinellas County's 13 %.
const basis: RefundBasis = {
  nightsSubtotal: 900,
  weeklyDiscount: 0,
  additionalGuestFee: 0,
  cleaningFee: 120,
  serviceFee: 108,
  extrasTotal: 0,
  taxes: 117,
}

const bookedAt = new Date('2026-06-01T10:00:00Z')
const checkIn = '2026-08-30'

describe('daysUntilCheckIn', () => {
  it('counts the day before arrival as one day, at any hour', () => {
    expect(daysUntilCheckIn(checkIn, new Date('2026-08-29T00:01:00Z'))).toBe(1)
    expect(daysUntilCheckIn(checkIn, new Date('2026-08-29T23:59:00Z'))).toBe(1)
  })

  it('is zero on the day of arrival', () => {
    expect(daysUntilCheckIn(checkIn, new Date('2026-08-30T08:00:00Z'))).toBe(0)
  })
})

describe('proposeRefund', () => {
  it('MODERATE returns everything up to five days before', () => {
    const refund = proposeRefund({
      checkIn,
      bookedAt,
      policy: 'MODERATE',
      basis,
      now: new Date('2026-08-25T12:00:00Z'),
    })

    expect(refund.reason).toBe('FULL')
    expect(refund.rate).toBe(1)
    // Every line back: 900 + 108 + 117 + 120.
    expect(refund.total).toBe(1245)
  })

  it('MODERATE returns only what was never delivered from four days out', () => {
    const refund = proposeRefund({
      checkIn,
      bookedAt,
      policy: 'MODERATE',
      basis,
      now: new Date('2026-08-26T12:00:00Z'),
    })

    expect(refund.reason).toBe('NONE')
    expect(refund.accommodation).toBe(0)
    expect(refund.serviceFee).toBe(0)
    expect(refund.taxes).toBe(0)
    // Nobody cleaned the house, so the cleaning fee goes back even at 0 %.
    expect(refund.cleaningFee).toBe(120)
    expect(refund.total).toBe(120)
  })

  it('FIRM halves the stay between thirty and seven days out', () => {
    const refund = proposeRefund({
      checkIn,
      bookedAt,
      policy: 'FIRM',
      basis,
      now: new Date('2026-08-10T12:00:00Z'),
    })

    expect(refund.reason).toBe('HALF')
    // Half the nights, half the service fee, half the tax, all the cleaning.
    expect(refund.accommodation).toBe(450)
    expect(refund.serviceFee).toBe(54)
    expect(refund.taxes).toBe(58.5)
    expect(refund.total).toBe(682.5)
  })

  it('STRICT still refunds in full inside its 48-hour grace window', () => {
    const bookedNow = new Date('2026-08-01T10:00:00Z')
    const refund = proposeRefund({
      checkIn,
      bookedAt: bookedNow,
      policy: 'STRICT',
      basis,
      now: new Date('2026-08-02T09:00:00Z'),
    })

    expect(refund.reason).toBe('GRACE')
    expect(refund.total).toBe(1245)
  })

  it('STRICT loses the grace window once it has passed', () => {
    const bookedNow = new Date('2026-08-01T10:00:00Z')
    const refund = proposeRefund({
      checkIn,
      bookedAt: bookedNow,
      policy: 'STRICT',
      basis,
      now: new Date('2026-08-04T09:00:00Z'),
    })

    // Still more than seven days out, so the half rung applies.
    expect(refund.reason).toBe('HALF')
  })

  it('STRICT has no grace window on a stay booked at short notice', () => {
    // Booked ten days before arrival: under the fourteen the rule requires.
    const refund = proposeRefund({
      checkIn,
      bookedAt: new Date('2026-08-20T10:00:00Z'),
      policy: 'STRICT',
      basis,
      now: new Date('2026-08-20T11:00:00Z'),
    })

    expect(refund.reason).toBe('HALF')
  })

  it('proposes nothing once the stay has started', () => {
    const refund = proposeRefund({
      checkIn,
      bookedAt,
      policy: 'FLEXIBLE',
      basis,
      now: new Date('2026-08-30T15:00:00Z'),
    })

    expect(refund.reason).toBe('STAY_STARTED')
    expect(refund.total).toBe(0)
    // Not even the cleaning: the house was made ready for someone who came.
    expect(refund.cleaningFee).toBe(0)
  })

  it('applies the weekly discount before the refund, not after', () => {
    // A discounted stay must not get back more than it paid for the nights.
    const discounted: RefundBasis = { ...basis, nightsSubtotal: 2100, weeklyDiscount: 210 }
    const refund = proposeRefund({
      checkIn,
      bookedAt,
      policy: 'FLEXIBLE',
      basis: discounted,
      now: new Date('2026-08-20T12:00:00Z'),
    })

    expect(refund.accommodation).toBe(1890)
  })

  it('returns extras whole, since none of them were delivered', () => {
    const withExtras: RefundBasis = { ...basis, extrasTotal: 250 }
    const refund = proposeRefund({
      checkIn,
      bookedAt,
      policy: 'MODERATE',
      basis: withExtras,
      now: new Date('2026-08-26T12:00:00Z'),
    })

    expect(refund.reason).toBe('NONE')
    expect(refund.extras).toBe(250)
  })

  it('never proposes more than the guest paid', () => {
    const total =
      basis.nightsSubtotal -
      basis.weeklyDiscount +
      basis.additionalGuestFee +
      basis.cleaningFee +
      basis.serviceFee +
      basis.extrasTotal +
      basis.taxes

    for (const policy of ['FLEXIBLE', 'MODERATE', 'FIRM', 'STRICT'] as const) {
      for (const day of ['2026-06-02', '2026-07-15', '2026-08-01', '2026-08-25', '2026-08-29']) {
        const refund = proposeRefund({
          checkIn,
          bookedAt,
          policy,
          basis,
          now: new Date(`${day}T12:00:00Z`),
        })
        expect(refund.total).toBeLessThanOrEqual(total)
        expect(refund.total).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
