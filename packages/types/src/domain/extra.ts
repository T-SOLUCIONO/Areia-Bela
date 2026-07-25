export type ExtraKey = 'heated-pool' | 'certified-nanny' | 'additional-guest' | 'pet'

export type ExtraPricingType = 'per-night' | 'per-hour' | 'per-stay'

export interface Extra {
  id: string
  key: ExtraKey
  name: Record<'es' | 'en', string>
  pricingType: ExtraPricingType
  price: number
  refundable: boolean
  /** e.g. heated pool is only billed Oct 1 - May 1 */
  seasonStartMonthDay?: string // "10-01"
  seasonEndMonthDay?: string // "05-01"
  requiresRequest?: boolean // e.g. nanny is on-request
  active: boolean
}
