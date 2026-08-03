import { computeQuote, minNightsFor, type PriceRuleInput } from '@areia-bela/shared'

/**
 * The seasonal floor, pinned.
 *
 * A wrong answer here either turns away a booking the house wanted or lets a
 * single night take a peak week off the calendar, so every rung is asserted
 * rather than trusted.
 */

const RULES: PriceRuleInput[] = [
  { type: 'LOW', nightlyRate: 300 },
  { type: 'WEEKEND', nightlyRate: 350, minNights: 2 },
  {
    type: 'HIGH',
    nightlyRate: 500,
    startDate: '2026-12-20',
    endDate: '2027-01-05',
    minNights: 7,
  },
]

const pricing = { priceRules: RULES, minNights: 1 }

describe('minNightsFor', () => {
  it('falls back to the house when the season sets none', () => {
    // A Tuesday in March: no high season, not a weekend.
    expect(minNightsFor('2026-03-10', pricing)).toBe(1)
  })

  it('takes the peak season floor when the stay starts inside it', () => {
    expect(minNightsFor('2026-12-24', pricing)).toBe(7)
  })

  it('takes the weekend floor on a Friday', () => {
    // 2026-03-13 is a Friday.
    expect(minNightsFor('2026-03-13', pricing)).toBe(2)
  })

  it('lets peak season beat the weekend rule', () => {
    // 2026-12-25 is a Friday and inside the peak range. Peak wins, as it does
    // for the rate.
    expect(minNightsFor('2026-12-25', pricing)).toBe(7)
  })

  it('never goes below the house minimum', () => {
    // The house asks for three; the weekend rule only asks for two.
    expect(minNightsFor('2026-03-13', { priceRules: RULES, minNights: 3 })).toBe(3)
  })

  it('is decided by the arrival date, not by the nights that follow', () => {
    // Thursday 17 December, three days before peak season opens. A stay
    // starting here can run straight into Christmas and still only owes the
    // low-season floor. Declared behaviour, not an oversight — see the doc
    // comment on minNightsFor. (The 18th and 19th are Friday and Saturday, so
    // they would answer 2 for the weekend rule, not for the peak one.)
    expect(minNightsFor('2026-12-17', pricing)).toBe(1)
  })
})

describe('computeQuote', () => {
  const base = {
    priceRules: RULES,
    cleaningFee: 120,
    serviceFeePercent: 12,
    taxesPercent: 13,
    additionalGuestFeePerNight: 0,
    includedGuests: 8,
    maxGuests: 8,
    weeklyDiscountPercent: 10,
    weeklyDiscountNights: 7,
    minNights: 1,
    maxNights: 365,
    extras: [],
  }

  it('reports the minimum these particular dates require', () => {
    const quote = computeQuote({
      checkIn: '2026-12-24',
      checkOut: '2026-12-27',
      selectedExtraIds: [],
      pricing: base,
    })

    expect(quote.minNights).toBe(7)
    // Still priced: a stay that is too short has a price worth showing, so the
    // guest sees what a valid stay would cost instead of a blank card.
    expect(quote.nights).toBe(3)
    expect(quote.total).toBeGreaterThan(0)
  })

  it('reports the house minimum outside any season', () => {
    const quote = computeQuote({
      checkIn: '2026-03-10',
      checkOut: '2026-03-13',
      selectedExtraIds: [],
      pricing: base,
    })

    expect(quote.minNights).toBe(1)
  })

  it('prices peak nights at the peak rate, minimum aside', () => {
    const quote = computeQuote({
      checkIn: '2026-12-24',
      checkOut: '2026-12-27',
      selectedExtraIds: [],
      pricing: base,
    })

    // Three nights at 500, none of them charged at the weekend rate even
    // though the 25th is a Friday.
    expect(quote.subtotal).toBe(1500)
    expect(quote.nightly.every((night) => night.season === 'HIGH')).toBe(true)
  })
})
