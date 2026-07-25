export interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface GuestCounts {
  adults: number
  children: number
  infants: number
}

/** Only adults and children (>2 years) count toward property.maxGuests. */
export function countedGuests(counts: GuestCounts): number {
  return counts.adults + counts.children
}
