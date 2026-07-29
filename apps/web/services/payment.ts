/**
 * The only payment call the site makes.
 *
 * `createPaymentIntent`, `processBookingPayment`, `refundPayment` and
 * `getPaymentMethods` used to live here as simulations — one of them decided
 * whether a payment succeeded with `Math.random() > 0.05`. None had a caller.
 * Real payment handling is Fase 7, and simulated money is worse than none.
 */
export interface CheckoutSession {
  id: string
  url: string
}

/**
 * What the browser is allowed to say about a booking: when, who, and which
 * extras. Never how much.
 *
 * The route prices these dates against the API and charges that. It used to
 * accept `totalPrice` from here and pass it straight to Stripe, which made the
 * price a suggestion from whoever had the page open.
 */
export interface CheckoutRequest {
  checkIn: string
  checkOut: string
  extraIds: string[]
  /** Units per extra — two dogs is two pet fees, and the route re-prices it. */
  extraUnits: Record<string, number>
  guests: { adults: number; children: number; infants: number; pets: number }
}

export async function createCheckoutSession(booking: CheckoutRequest): Promise<CheckoutSession> {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? 'Failed to create checkout session')
  }

  return (await response.json()) as CheckoutSession
}
