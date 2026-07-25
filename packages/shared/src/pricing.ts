/**
 * Server-side mirror of apps/web/lib/booking.ts's buildQuote(). Kept as a
 * pure function (no DB, no framework) so it can run identically from the
 * NestJS quote endpoint and be unit-tested against the client calculation
 * without spinning up a database.
 */

export interface PropertyPricingInput {
  pricePerNight: number
  cleaningFee: number
  serviceFeePercent: number
  taxesPercent: number
  extras: Array<{ id: string; label: string; pricePerNight: number }>
}

export interface ComputeQuoteInput {
  checkIn: string
  checkOut: string
  selectedExtraIds: string[]
  pricing: PropertyPricingInput
}

export interface QuoteExtraLine {
  id: string
  label: string
  pricePerNight: number
  total: number
}

export interface QuoteBreakdown {
  nights: number
  pricePerNight: number
  extras: QuoteExtraLine[]
  subtotal: number
  extrasTotal: number
  cleaningFee: number
  serviceFee: number
  taxes: number
  total: number
}

export function getNightsBetween(checkIn: string, checkOut: string): number {
  const start = Date.parse(checkIn)
  const end = Date.parse(checkOut)
  const diffDays = Math.round((end - start) / 86_400_000)
  return Math.max(0, diffDays)
}

export function computeQuote(input: ComputeQuoteInput): QuoteBreakdown {
  const nights = getNightsBetween(input.checkIn, input.checkOut)
  const { pricing } = input
  const subtotal = pricing.pricePerNight * nights

  const extras: QuoteExtraLine[] = pricing.extras
    .filter((extra) => input.selectedExtraIds.includes(extra.id))
    .map((extra) => ({
      id: extra.id,
      label: extra.label,
      pricePerNight: extra.pricePerNight,
      total: extra.pricePerNight * nights,
    }))
  const extrasTotal = extras.reduce((acc, extra) => acc + extra.total, 0)

  const serviceFee = Math.round(subtotal * (pricing.serviceFeePercent / 100))
  const taxes = Math.round(subtotal * (pricing.taxesPercent / 100))
  const total = subtotal + extrasTotal + pricing.cleaningFee + serviceFee + taxes

  return {
    nights,
    pricePerNight: pricing.pricePerNight,
    extras,
    subtotal,
    extrasTotal,
    cleaningFee: pricing.cleaningFee,
    serviceFee,
    taxes,
    total,
  }
}
