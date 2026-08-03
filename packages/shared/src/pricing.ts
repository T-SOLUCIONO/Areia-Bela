/**
 * What a stay costs. A pure function — no database, no framework — so the API
 * can price a quote and price a booking with the same code, and so it can be
 * tested without a database.
 *
 * This is the only place a total is ever computed. The browser asks for one;
 * it never works one out (CLAUDE.md: price is server-authoritative).
 */

export type ExtraPricingType = 'PER_NIGHT' | 'PER_HOUR' | 'PER_STAY'
export type SeasonType = 'LOW' | 'HIGH' | 'WEEKEND'

export interface PriceRuleInput {
  type: SeasonType
  nightlyRate: number
  /** ISO dates. Null on the recurring WEEKEND rule, which has no range. */
  startDate?: string | null
  endDate?: string | null
  /**
   * How many nights a stay starting in this season must be.
   *
   * Null means the season sets no floor of its own and the house's applies.
   * Peak weeks are the reason this exists: a single night over Christmas costs
   * the host the whole week.
   */
  minNights?: number | null
}

export interface ExtraInput {
  id: string
  label: string
  price: number
  pricingType: ExtraPricingType
  /** "MM-DD". The heated pool is only offered part of the year. */
  seasonStartMonthDay?: string | null
  seasonEndMonthDay?: string | null
}

export interface PropertyPricingInput {
  priceRules: PriceRuleInput[]
  cleaningFee: number
  serviceFeePercent: number
  taxesPercent: number
  /** Charged per night for each guest above `includedGuests`. */
  additionalGuestFeePerNight: number
  includedGuests: number
  maxGuests: number
  /** Taken off the nights once the stay reaches `weeklyDiscountNights`. */
  weeklyDiscountPercent: number
  weeklyDiscountNights: number
  /** How short and how long a stay may be. Both inclusive. */
  minNights: number
  maxNights: number
  extras: ExtraInput[]
}

/** Why a stay cannot be booked, when the reason is its length. */
export type StayLengthProblem =
  | { kind: 'tooShort'; minNights: number; nights: number }
  | { kind: 'tooLong'; maxNights: number; nights: number }

/**
 * Checks the stay against the house's limits.
 *
 * Separate from `computeQuote` because a stay that is one night too short
 * still has a price worth showing — the guest needs to see what a valid stay
 * would cost, not an error where the total should be. The booking endpoint is
 * what refuses; this is what lets the calendar explain itself.
 */
export function checkStayLength(
  nights: number,
  pricing: Pick<PropertyPricingInput, 'minNights' | 'maxNights'>,
): StayLengthProblem | null {
  if (nights > 0 && nights < pricing.minNights) {
    return { kind: 'tooShort', minNights: pricing.minNights, nights }
  }
  if (nights > pricing.maxNights) {
    return { kind: 'tooLong', maxNights: pricing.maxNights, nights }
  }
  return null
}

export interface ComputeQuoteInput {
  checkIn: string
  checkOut: string
  /** Adults + children. Infants never count towards capacity or price. */
  guests?: number
  selectedExtraIds: string[]
  /**
   * How many units of an extra, keyed by its id. What a unit is depends on the
   * extra: hours for the nanny, animals for the pet fee. Defaults to one.
   */
  extraUnits?: Record<string, number>
  pricing: PropertyPricingInput
}

export interface QuoteExtraLine {
  id: string
  label: string
  /** The unit price; what a unit *is* depends on `pricingType`. */
  price: number
  pricingType: ExtraPricingType
  quantity: number
  total: number
}

export interface QuoteNightLine {
  date: string
  rate: number
  season: SeasonType
}

export interface QuoteBreakdown {
  nights: number
  /** What these particular dates require, which the house-wide figure may not say. */
  minNights: number
  /** The average, for the "$X × N nights" line. Rates can differ per night. */
  pricePerNight: number
  /** Every night with the rate that applied, so a total is always explainable. */
  nightly: QuoteNightLine[]
  extras: QuoteExtraLine[]
  subtotal: number
  /** Positive when a discount applies; subtracted from the total. */
  weeklyDiscount: number
  extrasTotal: number
  additionalGuestFee: number
  cleaningFee: number
  serviceFee: number
  taxes: number
  total: number
}

const DAY_MS = 86_400_000

export function getNightsBetween(checkIn: string, checkOut: string): number {
  const diffDays = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / DAY_MS)
  return Math.max(0, diffDays)
}

/** Every night of the stay. Check-out is not a night, so it is excluded. */
export function nightsOf(checkIn: string, checkOut: string): string[] {
  const nights: string[] = []
  const start = Date.parse(checkIn)

  for (let index = 0; index < getNightsBetween(checkIn, checkOut); index += 1) {
    nights.push(new Date(start + index * DAY_MS).toISOString().slice(0, 10))
  }

  return nights
}

const isWeekend = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 5 || day === 6 // Friday and Saturday nights.
}

const within = (date: string, start?: string | null, end?: string | null) =>
  Boolean(start && end && date >= start.slice(0, 10) && date <= end.slice(0, 10))

/**
 * Which rule governs one night.
 *
 * A dated HIGH rule wins over the recurring WEEKEND one: a weekend inside peak
 * season should be charged at the peak rate, not the weekend rate. LOW is the
 * base and applies whenever nothing else does.
 */
export function ruleForNight(
  date: string,
  rules: PriceRuleInput[],
): { rule: PriceRuleInput | undefined; season: SeasonType } {
  const high = rules.find(
    (rule) => rule.type === 'HIGH' && within(date, rule.startDate, rule.endDate),
  )
  if (high) return { rule: high, season: 'HIGH' }

  const weekend = rules.find((rule) => rule.type === 'WEEKEND')
  if (weekend && isWeekend(date)) return { rule: weekend, season: 'WEEKEND' }

  return { rule: rules.find((rule) => rule.type === 'LOW'), season: 'LOW' }
}

/** The rate for one night. */
export function rateForNight(
  date: string,
  rules: PriceRuleInput[],
): { rate: number; season: SeasonType } {
  const { rule, season } = ruleForNight(date, rules)
  return { rate: rule?.nightlyRate ?? 0, season }
}

/**
 * The shortest stay allowed for these dates.
 *
 * Decided by the **arrival date**, not by every night the stay touches. That is
 * what guests already understand from booking elsewhere, and it is the version
 * that can be explained on a calendar: "arriving this week means at least five
 * nights". Taking the strictest rule the stay grazes would mean a February
 * booking that ends on the first day of peak season suddenly needs a week, for
 * a reason nobody could see when they picked the dates.
 *
 * The cost of that choice is real and worth naming: someone arriving the night
 * before a peak week gets the low-season minimum for a stay that is mostly peak.
 */
export function minNightsFor(
  checkIn: string,
  pricing: Pick<PropertyPricingInput, 'priceRules' | 'minNights'>,
): number {
  const { rule } = ruleForNight(checkIn, pricing.priceRules)
  // The house's own floor is never undercut by a season: a season can only ask
  // for more nights, never fewer.
  return Math.max(pricing.minNights, rule?.minNights ?? 0)
}

/**
 * Whether a seasonal extra is available for a date.
 *
 * The window is stored as "MM-DD" and may wrap the new year — the heated pool
 * runs 10-01 to 05-01 — so a plain `start <= date <= end` comparison would
 * make it available for exactly none of the year.
 */
export function extraAvailableOn(extra: ExtraInput, date: string): boolean {
  const { seasonStartMonthDay: start, seasonEndMonthDay: end } = extra
  if (!start || !end) return true

  const monthDay = date.slice(5, 10)
  return start <= end ? monthDay >= start && monthDay <= end : monthDay >= start || monthDay <= end
}

/** How many units of an extra a stay buys, given how it is charged. */
function quantityFor(extra: ExtraInput, nights: string[], units: Record<string, number>): number {
  switch (extra.pricingType) {
    case 'PER_STAY':
      // Once per unit, regardless of length: two dogs is two pet fees, but a
      // fortnight with one dog is still one. This used to multiply by nights,
      // so a week with a dog was billed seven times over.
      return Math.max(0, units[extra.id] ?? 1)
    case 'PER_HOUR':
      // Only what was asked for. Zero means the guest picked the extra but no
      // hours, which costs nothing rather than silently billing an hour.
      return Math.max(0, units[extra.id] ?? 0)
    case 'PER_NIGHT':
    default:
      // Seasonal extras are only charged for the nights they are offered.
      return nights.filter((night) => extraAvailableOn(extra, night)).length
  }
}

export function computeQuote(input: ComputeQuoteInput): QuoteBreakdown {
  const { pricing } = input
  const nights = nightsOf(input.checkIn, input.checkOut)
  const units = input.extraUnits ?? {}

  const nightly: QuoteNightLine[] = nights.map((date) => ({
    date,
    ...rateForNight(date, pricing.priceRules),
  }))
  const subtotal = nightly.reduce((sum, night) => sum + night.rate, 0)

  const extras: QuoteExtraLine[] = pricing.extras
    .filter((extra) => input.selectedExtraIds.includes(extra.id))
    .map((extra) => {
      const quantity = quantityFor(extra, nights, units)
      return {
        id: extra.id,
        label: extra.label,
        price: extra.price,
        pricingType: extra.pricingType,
        quantity,
        total: extra.price * quantity,
      }
    })
    // A seasonal extra outside its window, or an hourly one with no hours,
    // costs nothing — and a zero line on an invoice invites a support email.
    .filter((line) => line.total > 0)

  const extrasTotal = extras.reduce((sum, extra) => sum + extra.total, 0)

  const extraGuests = Math.max(0, (input.guests ?? pricing.includedGuests) - pricing.includedGuests)
  const additionalGuestFee = extraGuests * pricing.additionalGuestFeePerNight * nights.length

  // Off the nights only, the way a guest reads it: the cleaning fee and the
  // extras are not discounted for staying longer.
  const weeklyDiscount =
    nights.length >= pricing.weeklyDiscountNights
      ? Math.round(subtotal * (pricing.weeklyDiscountPercent / 100))
      : 0

  // Percentages apply to what the house costs after the discount — charging
  // tax on a sum nobody pays is the kind of thing guests notice.
  const accommodation = subtotal - weeklyDiscount + additionalGuestFee
  const serviceFee = Math.round(accommodation * (pricing.serviceFeePercent / 100))
  const taxes = Math.round(accommodation * (pricing.taxesPercent / 100))

  return {
    nights: nights.length,
    minNights: minNightsFor(input.checkIn, pricing),
    pricePerNight: nights.length > 0 ? Math.round(subtotal / nights.length) : 0,
    nightly,
    extras,
    subtotal,
    weeklyDiscount,
    extrasTotal,
    additionalGuestFee,
    cleaningFee: pricing.cleaningFee,
    serviceFee,
    taxes,
    total: accommodation + extrasTotal + pricing.cleaningFee + serviceFee + taxes,
  }
}
