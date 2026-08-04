import type { ConfigService } from '@nestjs/config'
import { MailService } from './mail.service'

/**
 * What `send` is allowed to claim.
 *
 * The return value is the whole point of these: callers log "Sent confirmation
 * to the guest" from it, and in production that line once appeared one
 * millisecond after this service warned that nothing had been sent.
 */
const configOf = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService

const anEmail = {
  to: 'guest@example.com',
  subject: 'Tu reserva en Areia Bela · AB-TEST01',
  text: 'body',
  html: '<p>body</p>',
}

describe('MailService.send', () => {
  const fetchMock = jest.fn()
  const originalFetch = global.fetch

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('says false when there is no API key, and sends nothing', async () => {
    const service = new MailService(configOf({}))

    await expect(service.send(anEmail)).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says false when the provider refuses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'sender not verified',
    })
    const service = new MailService(configOf({ BREVO_API_KEY: 'xkeysib-test' }))

    await expect(service.send(anEmail)).resolves.toBe(false)
  })

  it('says true only when the provider accepted it', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 })
    const service = new MailService(configOf({ BREVO_API_KEY: 'xkeysib-test' }))

    await expect(service.send(anEmail)).resolves.toBe(true)
  })

  it('reads the sender from either name, preferring the documented one', async () => {
    // `BREVO_SENDER_EMAIL` was passed by docker-compose.prod.yml and read by
    // nothing: a deployment configured exactly as documented fell back to a
    // default address on a domain it may not own, and Brevo refuses those.
    fetchMock.mockResolvedValue({ ok: true, status: 201 })
    const senderOf = async (values: Record<string, string>) => {
      fetchMock.mockClear()
      await new MailService(configOf({ BREVO_API_KEY: 'xkeysib-test', ...values })).send(anEmail)
      return (
        JSON.parse(fetchMock.mock.calls[0][1].body as string) as { sender: { email: string } }
      ).sender.email
    }

    expect(await senderOf({ BREVO_SENDER_EMAIL: 'alias@example.com' })).toBe('alias@example.com')
    expect(await senderOf({ EMAIL_FROM_ADDRESS: 'documented@example.com' })).toBe(
      'documented@example.com',
    )
    expect(
      await senderOf({
        EMAIL_FROM_ADDRESS: 'documented@example.com',
        BREVO_SENDER_EMAIL: 'alias@example.com',
      }),
    ).toBe('documented@example.com')
  })
})
