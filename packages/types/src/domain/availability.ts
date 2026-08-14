export interface BlockedDate {
  id: string
  propertyId: string
  /** `yyyy-mm-dd`. A day, not an instant — see the note in `asDay`. */
  startDate: string
  /** `yyyy-mm-dd`, and **inclusive**: the night of this day is closed too. */
  endDate: string
  reason?: string
}

export type AvailabilityDayStatus = 'available' | 'blocked'

export interface AvailabilityDay {
  date: string
  status: AvailabilityDayStatus
}
