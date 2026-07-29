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
  extras: [
    { id: 'pet', label: 'Pet', price: 100, pricingType: 'PER_STAY' },
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
  it('prices a plain week', () => {
    const result = quote()
    // 7 × 300 = 2100; service 12% = 252; tax 13% = 273; + 120 cleaning.
    expect(result.nights).toBe(7)
    expect(result.subtotal).toBe(2100)
    expect(result.serviceFee).toBe(252)
    expect(result.taxes).toBe(273)
    expect(result.total).toBe(2745)
  })

  it('charges a per-stay extra once, not once per night', () => {
    // The bug this replaces: a week with a dog was billed $700 instead of $100.
    const result = quote({ selectedExtraIds: ['pet'] })
    const pet = result.extras.find((extra) => extra.id === 'pet')

    expect(pet).toMatchObject({ quantity: 1, total: 100 })
    expect(result.total).toBe(2845)
  })

  it('charges an hourly extra by the hour', () => {
    const result = quote({
      selectedExtraIds: ['certified-nanny'],
      extraHours: { 'certified-nanny': 4 },
    })
    expect(result.extras[0]).toMatchObject({ quantity: 4, total: 80 })
  })

  it('drops an hourly extra with no hours instead of billing one', () => {
    const result = quote({ selectedExtraIds: ['certified-nanny'] })
    expect(result.extras).toHaveLength(0)
    expect(result.total).toBe(2745)
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
    // The surcharge is part of what the house costs, so it is taxed.
    expect(result.serviceFee).toBe(Math.round((2100 + 420) * 0.12))
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

  it('is zero-length rather than negative when the dates are backwards', () => {
    const result = quote({ checkIn: '2026-09-08', checkOut: '2026-09-01' })
    expect(result.nights).toBe(0)
    expect(result.subtotal).toBe(0)
  })
})
