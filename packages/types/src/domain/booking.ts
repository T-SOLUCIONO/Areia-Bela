import type { GuestCounts } from './customer'
import type { ExtraKey } from './extra'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'checked-in' | 'checked-out'

export interface SelectedExtra {
  extraKey: ExtraKey
  quantity: number
}

export interface Booking {
  id: string
  propertyId: string
  customerId: string
  checkIn: string
  checkOut: string
  guests: GuestCounts
  extras: SelectedExtra[]
  status: BookingStatus
  totalPrice: number
  specialRequests?: string
  createdAt: string
  updatedAt: string
}
