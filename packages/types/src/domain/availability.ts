export interface BlockedDate {
  id: string
  propertyId: string
  startDate: string
  endDate: string
  reason?: string
}

export type AvailabilityDayStatus = 'available' | 'blocked'

export interface AvailabilityDay {
  date: string
  status: AvailabilityDayStatus
}
