import type { Reservation, BookingDetails, GuestInfo, PaymentInfo } from '@/types'
import { reservations } from '@/lib/mock-data'

// Placeholder functions ready for real implementation
export async function createReservation(
  bookingDetails: BookingDetails,
  guestInfo: GuestInfo,
  paymentInfo: PaymentInfo,
): Promise<Reservation> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const newReservation: Reservation = {
    id: `res-${Date.now()}`,
    guestId: `guest-${Date.now()}`,
    guestName: `${guestInfo.firstName} ${guestInfo.lastName}`,
    guestEmail: guestInfo.email,
    guestPhone: guestInfo.phone,
    roomId: bookingDetails.roomId,
    roomType: bookingDetails.roomType,
    roomName: bookingDetails.roomName,
    checkIn: bookingDetails.checkIn,
    checkOut: bookingDetails.checkOut,
    guests: bookingDetails.guests,
    adults: bookingDetails.adults,
    children: bookingDetails.children,
    status: 'confirmed',
    totalPrice: bookingDetails.totalPrice,
    nightPrice: bookingDetails.nightPrice,
    cleaningFee: bookingDetails.cleaningFee,
    serviceFee: bookingDetails.serviceFee,
    taxes: bookingDetails.taxes,
    specialRequests: guestInfo.specialRequests,
    paymentMethod: paymentInfo.method,
    channel: 'direct',
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
  }

  return newReservation
}

export async function getReservation(id: string): Promise<Reservation | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return reservations.find((r) => r.id === id)
}

export async function getReservations(): Promise<Reservation[]> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return reservations
}

export async function updateReservationStatus(
  id: string,
  status: Reservation['status'],
): Promise<Reservation | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const reservation = reservations.find((r) => r.id === id)
  if (reservation) {
    reservation.status = status
    reservation.updatedAt = new Date().toISOString().split('T')[0]
  }
  return reservation
}

export async function cancelReservation(id: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 500))
  const reservation = reservations.find((r) => r.id === id)
  if (reservation) {
    reservation.status = 'cancelled'
    reservation.updatedAt = new Date().toISOString().split('T')[0]
    return true
  }
  return false
}
