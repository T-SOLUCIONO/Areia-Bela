import {
  computeQuote,
  extraAvailableOn,
  nightsOf,
  rateForNight,
  type ComputeQuoteInput,
  type ExtraInput,
  type PropertyPricingInput,
} from '@areia-bela/shared'

/**
 * The house's real figures, from docs/domain-decisions.md and datos.json.
 * Every expected total below is arithmetic on these, not a recorded snapshot.
 */
const PRICING: PropertyPricingInput = {
  priceRules: [{ type: 'LOW', nightlyRate: 300 }],
  cleaningFee: 120,
  serviceFeePercent: 12,
  taxesPercent: 13,
  additionalGuestFeePerNight: 30,
  includedGuests: 8,
  maxGuests: 8,
  weeklyDiscountPercent: 10,
  weeklyDiscountNights: 7,
  // The real listing's limits: one night up to a year (datos.json).
  minNights: 1,
  maxNights: 365,
  extras: [
    { id: 'pet', label: 'Pet', price: 115, pricingType: 'PER_STAY' },
    { id: 'certified-nanny', label: 'Nanny', price: 20, pricingType: 'PER_HOUR' },
    {
      id: 'heated-pool',
      label: 'Heated pool',
      price: 20,
      pricingType: 'PER_NIGHT',
      seasonStartMonthDay: '10-01',
      seasonEndMonthDay: '05-01',
    },
    { id: 'additional-guest', label: 'Extra guest', price: 30, pricingType: 'PER_NIGHT' },
  ],
}

const quote = (overrides: Partial<ComputeQuoteInput> = {}) =>
  computeQuote({
    checkIn: '2026-09-01',
    checkOut: '2026-09-08',
    selectedExtraIds: [],
    pricing: PRICING,
    ...overrides,
  })

describe('nightsOf', () => {
  it('counts nights, not days — check-out is not a night', () => {
    expect(nightsOf('2026-09-01', '2026-09-04')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('is empty when check-in and check-out are the same day', () => {
    expect(nightsOf('2026-09-01', '2026-09-01')).toEqual([])
  })

  it('crosses a month boundary', () => {
    expect(nightsOf('2026-09-30', '2026-10-02')).toEqual(['2026-09-30', '2026-10-01'])
  })
})

describe('rateForNight', () => {
  const rules = [
    { type: 'LOW' as const, nightlyRate: 300 },
    { type: 'WEEKEND' as const, nightlyRate: 380 },
    {
      type: 'HIGH' as const,
      nightlyRate: 500,
      startDate: '2026-12-20',
      endDate: '2027-01-05',
    },
  ]

  it('falls back to the base rate', () => {
    // 2026-09-01 is a Tuesday, outside any season.
    expect(rateForNight('2026-09-01', rules)).toEqual({ rate: 300, season: 'LOW' })
  })

  it('charges the weekend rate on Friday and Saturday nights', () => {
    expect(rateForNight('2026-09-04', rules).season).toBe('WEEKEND') // Friday
    expect(rateForNight('2026-09-05', rules).season).toBe('WEEKEND') // Saturday
    expect(rateForNight('2026-09-06', rules).season).toBe('LOW') // Sunday
  })

  it('lets a dated season beat the recurring weekend rule', () => {
    // 2026-12-25 is a Friday inside the holiday range. A weekend in peak
    // season should cost the peak rate, not the cheaper weekend one.
    expect(rateForNight('2026-12-25', rules)).toEqual({ rate: 500, season: 'HIGH' })
  })

  it('returns zero rather than guessing when no rule matches', () => {
    expect(rateForNight('2026-09-01', []).rate).toBe(0)
  })
})

describe('extraAvailableOn', () => {
  const pool = PRICING.extras.find((extra) => extra.id === 'heated-pool') as ExtraInput

  it('spans the new year, because the pool season does', () => {
    // 10-01 to 05-01 wraps December. A plain start <= date <= end comparison
    // would make this available on no day of the year.
    expect(extraAvailableOn(pool, '2026-12-24')).toBe(true)
    expect(extraAvailableOn(pool, '2026-10-01')).toBe(true)
    expect(extraAvailableOn(pool, '2027-05-01')).toBe(true)
  })

  it('is closed in summer', () => {
    expect(extraAvailableOn(pool, '2026-07-15')).toBe(false)
    expect(extraAvailableOn(pool, '2026-09-30')).toBe(false)
  })

  it('treats an extra with no window as always available', () => {
    const pet = PRICING.extras.find((extra) => extra.id === 'pet') as ExtraInput
    expect(extraAvailableOn(pet, '2026-07-15')).toBe(true)
  })
})

describe('computeQuote', () => {
  it('prices a short stay with no discount', () => {
    // 3 × 300 = 900; service 12% = 108; tax 13% = 117; + 120 cleaning.
    const result = quote({ checkIn: '2026-09-01', checkOut: '2026-09-04' })
    expect(result.nights).toBe(3)
    expect(result.subtotal).toBe(900)
    expect(result.weeklyDiscount).toBe(0)
    expect(result.total).toBe(1245)
  })

  it('prices a week with the long-stay discount', () => {
    // 7 × 300 = 2100, less 10% = 1890; service 12% = 227; tax 13% = 246;
    // + 120 cleaning.
    const result = quote()
    expect(result.subtotal).toBe(2100)
    expect(result.weeklyDiscount).toBe(210)
    expect(result.serviceFee).toBe(227)
    expect(result.taxes).toBe(246)
    expect(result.total).toBe(2483)
  })

  it('charges a per-stay extra once, not once per night', () => {
    // The bug this replaces: a week with a dog was billed $700 instead of $100.
    const result = quote({ selectedExtraIds: ['pet'] })
    const pet = result.extras.find((extra) => extra.id === 'pet')

    expect(pet).toMatchObject({ quantity: 1, total: 115 })
    expect(result.total).toBe(2598)
  })

  it('charges an hourly extra by the hour', () => {
    const result = quote({
      selectedExtraIds: ['certified-nanny'],
      extraUnits: { 'certified-nanny': 4 },
    })
    expect(result.extras[0]).toMatchObject({ quantity: 4, total: 80 })
  })

  it('drops an hourly extra with no hours instead of billing one', () => {
    const result = quote({ selectedExtraIds: ['certified-nanny'] })
    expect(result.extras).toHaveLength(0)
    expect(result.total).toBe(2483)
  })

  it('charges the pet fee once per animal, not once per night', () => {
    const result = quote({ selectedExtraIds: ['pet'], extraUnits: { pet: 2 } })
    expect(result.extras[0]).toMatchObject({ quantity: 2, total: 230 })
  })

  it('does not charge a seasonal extra out of season', () => {
    // September is outside the pool season entirely.
    const result = quote({ selectedExtraIds: ['heated-pool'] })
    expect(result.extras).toHaveLength(0)
  })

  it('charges a seasonal extra only for the nights inside its window', () => {
    // 2026-09-28 → 2026-10-04: six nights, of which only 10-01, 10-02 and
    // 10-03 are in pool season.
    const result = computeQuote({
      checkIn: '2026-09-28',
      checkOut: '2026-10-04',
      selectedExtraIds: ['heated-pool'],
      pricing: PRICING,
    })

    expect(result.extras[0]).toMatchObject({ quantity: 3, total: 60 })
  })

  it('charges for guests above the included count', () => {
    const result = computeQuote({
      checkIn: '2026-09-01',
      checkOut: '2026-09-08',
      guests: 10,
      selectedExtraIds: [],
      pricing: { ...PRICING, includedGuests: 8 },
    })

    // Two extra guests × $30 × 7 nights.
    expect(result.additionalGuestFee).toBe(420)
    // Taxed on the discounted nights plus the surcharge.
    expect(result.serviceFee).toBe(Math.round((2100 - 210 + 420) * 0.12))
  })

  it('does not charge for guests at or under the included count', () => {
    expect(quote({ guests: 8 }).additionalGuestFee).toBe(0)
    expect(quote({ guests: 2 }).additionalGuestFee).toBe(0)
  })

  it('applies a different rate per night and explains each one', () => {
    const result = computeQuote({
      checkIn: '2026-09-03',
      checkOut: '2026-09-06',
      selectedExtraIds: [],
      pricing: {
        ...PRICING,
        priceRules: [
          { type: 'LOW', nightlyRate: 300 },
          { type: 'WEEKEND', nightlyRate: 380 },
        ],
      },
    })

    // Thursday 300, Friday 380, Saturday 380.
    expect(result.nightly.map((night) => night.rate)).toEqual([300, 380, 380])
    expect(result.subtotal).toBe(1060)
    // The headline "per night" is the average, rounded.
    expect(result.pricePerNight).toBe(353)
  })

  it('does not discount a stay one night short of the threshold', () => {
    const six = quote({ checkIn: '2026-09-01', checkOut: '2026-09-07' })
    expect(six.nights).toBe(6)
    expect(six.weeklyDiscount).toBe(0)

    const seven = quote({ checkIn: '2026-09-01', checkOut: '2026-09-08' })
    expect(seven.weeklyDiscount).toBeGreaterThan(0)
  })

  it('discounts only the nights, not the cleaning fee or the extras', () => {
    const result = quote({ selectedExtraIds: ['pet'] })
    // 10% of 2100, and nothing off the $120 cleaning or the $115 pet fee.
    expect(result.weeklyDiscount).toBe(210)
    expect(result.cleaningFee).toBe(120)
    expect(result.extrasTotal).toBe(115)
  })

  it('does not tax a sum nobody pays', () => {
    // Charging tax on the pre-discount subtotal is the kind of thing guests
    // notice on an invoice.
    const result = quote()
    expect(result.taxes).toBe(Math.round((result.subtotal - result.weeklyDiscount) * 0.13))
  })

  it('is zero-length rather than negative when the dates are backwards', () => {
    const result = quote({ checkIn: '2026-09-08', checkOut: '2026-09-01' })
    expect(result.nights).toBe(0)
    expect(result.subtotal).toBe(0)
  })
})

/**
 * The tax base, pinned down.
 *
 * Percentages apply to the accommodation only — not to the cleaning fee.
 * Nothing else in the codebase states this, and a backfill written against the
 * wrong assumption was off by exactly 25% of the cleaning fee on every
 * booking. A test is cheaper than finding that out on a receipt.
 */
describe('what service fees and taxes are charged on', () => {
  it('leaves the cleaning fee out of the base', () => {
    const quote = computeQuote({
      checkIn: '2026-07-31',
      checkOut: '2026-08-03',
      selectedExtraIds: [],
      pricing: PRICING,
    })

    // 3 nights × $300, and the percentages ignore the $120 cleaning fee.
    expect(quote.subtotal).toBe(900)
    expect(quote.cleaningFee).toBe(120)
    expect(quote.serviceFee).toBe(108) // 12% of 900, not of 1020
    expect(quote.taxes).toBe(117) // 13% of 900, not of 1020
    expect(quote.total).toBe(1245)
  })

  it('taxes what is actually paid, after the long-stay discount', () => {
    // Charging tax on a sum nobody pays is the kind of thing guests notice.
    const quote = computeQuote({
      checkIn: '2026-07-01',
      checkOut: '2026-07-08',
      selectedExtraIds: [],
      pricing: PRICING,
    })

    const accommodation = quote.subtotal - quote.weeklyDiscount
    expect(quote.weeklyDiscount).toBeGreaterThan(0)
    expect(quote.taxes).toBe(Math.round(accommodation * 0.13))
  })
})

/**
 * The threshold, pinned down.
 *
 * The price card used to draw a "weekly discount" on a two-night stay, for an
 * amount nobody was charged: it compared a static marketing price against the
 * nightly rate instead of reading the quote's own `weeklyDiscount`. The engine
 * was always right; the screen was not. These fix the engine's contract so the
 * screen has something unambiguous to render.
 */
describe('when the long-stay discount applies', () => {
  const nightsFor = (count: number) => {
    const end = new Date('2027-01-10T00:00:00Z')
    end.setUTCDate(end.getUTCDate() + count)
    return end.toISOString().slice(0, 10)
  }

  it.each([1, 2, 3, 6])('is zero at %i nights', (count) => {
    const quote = computeQuote({
      checkIn: '2027-01-10',
      checkOut: nightsFor(count),
      selectedExtraIds: [],
      pricing: PRICING,
    })

    expect(quote.nights).toBe(count)
    expect(quote.weeklyDiscount).toBe(0)
  })

  it('starts exactly at the configured threshold', () => {
    const quote = computeQuote({
      checkIn: '2027-01-10',
      checkOut: nightsFor(7),
      selectedExtraIds: [],
      pricing: PRICING,
    })

    // 7 nights × $300 × 10%
    expect(quote.weeklyDiscount).toBe(210)
  })

  it('disappears entirely when the host sets the percentage to zero', () => {
    const quote = computeQuote({
      checkIn: '2027-01-10',
      checkOut: nightsFor(10),
      selectedExtraIds: [],
      pricing: { ...PRICING, weeklyDiscountPercent: 0 },
    })

    expect(quote.weeklyDiscount).toBe(0)
  })
})
