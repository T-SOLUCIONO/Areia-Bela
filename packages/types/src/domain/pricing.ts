export type SeasonType = 'low' | 'high' | 'weekend'

export interface PriceRule {
  id: string
  name: string
  type: SeasonType
  /** ISO date range; omitted for the recurring "weekend" rule */
  startDate?: string
  endDate?: string
  nightlyRate: number
  active: boolean
}

export interface QuoteLineItem {
  label: string
  amount: number
}

export interface BookingQuote {
  propertyId: string
  checkIn: string
  checkOut: string
  nights: number
  baseTotal: number
  lineItems: QuoteLineItem[]
  totalPrice: number
}
