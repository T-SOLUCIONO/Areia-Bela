import type { Locale } from './cms'

/**
 * Areia Bela is modeled as a single whole-home vacation rental
 * (1 reservable unit), not a hotel with room inventory.
 * See docs/domain-decisions.md.
 */

export type BedType = 'queen' | 'twin-bunks' | 'sofa-bed'

export interface BedroomConfig {
  name: string
  beds: BedType[]
}

export interface TransferInfo {
  destination: string
  minutes: number
}

export interface PropertyLocation {
  address: string
  city: string
  state: string
  country: string
  latitude?: number
  longitude?: number
  transfers: TransferInfo[]
}

export type PolicyPenaltyKey =
  'pool-filter-damaged-by-pet' | 'trash-not-taken-out' | 'unauthorized-party'

export interface PolicyPenalty {
  key: PolicyPenaltyKey
  amount: number
}

export interface Property {
  id: string
  slug: string
  name: Record<Locale, string>
  description: Record<Locale, string>
  maxGuests: number
  additionalGuestFeePerNight: number
  bedrooms: BedroomConfig[]
  bathrooms: number
  amenities: string[]
  location: PropertyLocation
  checkInTime: string
  checkOutTime: string
  trashCollectionDays: string[]
  penalties: PolicyPenalty[]
  createdAt: string
  updatedAt: string
}
