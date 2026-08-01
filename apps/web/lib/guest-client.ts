import { API_URL } from '@/lib/api-client'

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT'

export type CancellationPolicy = 'FLEXIBLE' | 'MODERATE' | 'FIRM' | 'STRICT'

/** The bill as charged, read off the booking rather than recomputed. */
export interface BookingBill {
  nightsSubtotal: number
  weeklyDiscount: number
  extrasTotal: number
  additionalGuestFee: number
  cleaningFee: number
  serviceFee: number
  taxes: number
  total: number
}

export interface MyBooking {
  reference: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  adults: number
  children: number
  infants: number
  pets: number
  total: number
  bill: BookingBill
  status: BookingStatus
  extras: string[]
  specialRequests: string | null
  checkInTime: string
  checkOutTime: string
  /** Set only while an unpaid hold is still alive. */
  checkoutUrl: string | null
  cancellationPolicy: CancellationPolicy
  accessNotes: string | null
  houseRules: string | null
  trashCollectionDays: string[]
  address: string
  past: boolean
}

export interface MyDetails {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
}

/**
 * The guest area's calls.
 *
 * All of them carry the session cookie and none of them take an identifier:
 * the server scopes every query by whoever the cookie says you are. A booking
 * reference in a URL must never be enough to read someone else's stay.
 */
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/guest${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    cache: 'no-store',
  })
  if (!response.ok) throw new GuestApiError(response.status)
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

export class GuestApiError extends Error {
  constructor(readonly status: number) {
    super(`Guest API responded ${status}`)
  }
}

export const guest = {
  requestLink: (email: string, locale: string) =>
    call<void>('/login', { method: 'POST', body: JSON.stringify({ email, locale }) }),

  redeem: (token: string) =>
    call<{ name: string; email: string }>('/login/redeem', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  signOut: () => call<void>('/logout', { method: 'POST' }),

  me: () => call<MyDetails>('/me'),
  updateMe: (body: Partial<MyDetails>) =>
    call<MyDetails>('/me', { method: 'PATCH', body: JSON.stringify(body) }),

  bookings: () => call<MyBooking[]>('/bookings'),
}
