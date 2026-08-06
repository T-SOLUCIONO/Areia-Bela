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

  it('sends from the configured address', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 })
    await new MailService(
      configOf({ BREVO_API_KEY: 'xkeysib-test', EMAIL_FROM_ADDRESS: 'noreply@example.com' }),
    ).send(anEmail)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      sender: { email: string; name: string }
    }
    expect(body.sender.email).toBe('noreply@example.com')
    // The display name has a sensible default, so it is not required.
    expect(body.sender.name).toBe('Areia Bela')
  })
})
