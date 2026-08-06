import { ServiceUnavailableException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { PaymentsService } from './payments.service'

/**
 * What a guest is allowed to learn when Stripe says no.
 *
 * Stripe answers a bad API key with **401**, and that status once travelled
 * intact to a browser: a guest pressing "pay" was told they were not
 * authorised, on a public endpoint that never asked them to sign in. The
 * status pointed at the guest for a mistake made in the server's environment.
 */
const configOf = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService

const aRequest = {
  bookingId: 'bkg_1',
  reference: 'AB-TEST01',
  email: 'guest@example.com',
  checkIn: '2026-09-01',
  checkOut: '2026-09-08',
  nights: 7,
  total: 2100,
  guests: 4,
  origin: 'https://example.com',
}

describe('PaymentsService.checkoutUrlFor', () => {
  const withStripe = (create: jest.Mock) => {
    const service = new PaymentsService(configOf({ STRIPE_SECRET_KEY: 'sk_test_whatever' }))
    // Replacing the client is the only way to make Stripe fail on demand
    // without a network call.
    ;(service as unknown as { stripe: unknown }).stripe = {
      checkout: { sessions: { create } },
    }
    return service
  }

  it('turns a rejected API key into a 503, not Stripe`s 401', async () => {
    const stripe401 = Object.assign(new Error('Invalid API Key provided'), { statusCode: 401 })
    const service = withStripe(jest.fn().mockRejectedValue(stripe401))

    await expect(service.checkoutUrlFor(aRequest)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })

  it('never repeats what Stripe said to the guest', async () => {
    // The message names a server-side secret. It belongs in the logs.
    const stripe401 = Object.assign(new Error('Invalid API Key provided: whsec_123'), {
      statusCode: 401,
    })
    const service = withStripe(jest.fn().mockRejectedValue(stripe401))

    await expect(service.checkoutUrlFor(aRequest)).rejects.toThrow(
      'Payments are temporarily unavailable',
    )
  })

  it('still refuses loudly when no key is configured at all', async () => {
    const service = new PaymentsService(configOf({}))

    await expect(service.checkoutUrlFor(aRequest)).rejects.toThrow('Payments are not configured')
  })

  it('returns the URL when Stripe answers', async () => {
    const service = withStripe(
      jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' }),
    )

    await expect(service.checkoutUrlFor(aRequest)).resolves.toBe(
      'https://checkout.stripe.com/c/pay/cs_test_1',
    )
  })
})
