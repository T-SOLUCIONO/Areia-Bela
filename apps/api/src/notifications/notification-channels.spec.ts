import { Logger } from '@nestjs/common'
import {
  EmailChannel,
  MetaWhatsAppChannel,
  TelegramChannel,
  deliver,
} from './notification-channels'

describe('TelegramChannel', () => {
  const fetchMock = jest.fn()
  const originalFetch = global.fetch
  const channel = new TelegramChannel('bot-token')

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  /** The JSON the channel posted, for asserting on. */
  const sentBody = () =>
    JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>

  it('posts to the chat id it was given', async () => {
    await expect(channel.send('12345', 'Nueva reserva', 'Jane Doe')).resolves.toBe(true)

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.telegram.org/botbot-token/sendMessage')
    expect(sentBody().chat_id).toBe('12345')
  })

  it('escapes what MarkdownV2 reserves', async () => {
    // Telegram rejects the whole message — 400, nothing delivered — if a
    // reserved character arrives unescaped. Guest names and cancellation
    // reasons are free text, so "J. Smith-Doe" would have cost the host their
    // alert rather than mangling one word of it.
    await channel.send('12345', 'Reserva AB-XYZ', 'J. Smith-Doe (2 noches) · 50% + extras!')

    const text = sentBody().text as string
    // Collected rather than asserted one by one: the list is its own message,
    // and Jest's `expect` takes no second argument for one.
    const unescaped = ['.', '-', '(', ')', '!', '+', '='].filter((reserved) =>
      new RegExp(`(?<!\\\\)\\${reserved}`).test(text),
    )
    expect(unescaped).toEqual([])
  })

  it('keeps the subject as the first line, in bold', async () => {
    await channel.send('12345', 'Nueva reserva', 'Jane')

    // The same shape the WhatsApp channel uses: one recognisable format for the
    // host, whichever channel woke them up.
    expect(sentBody().text as string).toMatch(/^\*Nueva reserva\*/)
  })

  it('throws with Telegram’s own reason when it refuses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ description: 'chat not found' }),
    })

    await expect(channel.send('99999', 'Nueva reserva', 'Jane')).rejects.toThrow('chat not found')
  })

  it('refuses an empty chat id rather than posting nowhere', async () => {
    await expect(channel.send('   ', 'Nueva reserva', 'Jane')).rejects.toThrow('chat id')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('deliver', () => {
  it('does not claim a delivery the channel denied', async () => {
    // The failure this exists to prevent: `Sent "…" over Email` logged one
    // millisecond after the mailer warned it had sent nothing.
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger
    const mailer = { send: jest.fn().mockResolvedValue(false) }

    await deliver(
      [{ channel: new EmailChannel(mailer), to: 'host@example.com' }],
      'Nueva reserva',
      'Jane Doe',
      logger,
    )

    expect(logger.log).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not delivered'))
  })

  it('one channel failing does not stop the others', async () => {
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger
    const broken = {
      name: 'Roto',
      send: jest.fn().mockRejectedValue(new Error('sin red')),
    }
    const working = { name: 'Bueno', send: jest.fn().mockResolvedValue(true) }

    await deliver(
      [
        { channel: broken, to: 'a' },
        { channel: working, to: 'b' },
      ],
      'Nueva reserva',
      'Jane Doe',
      logger,
    )

    // A booking that succeeded must not report an error because one alert did
    // not go out, and the host still gets told through whatever does work.
    expect(working.send).toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('sin red'))
  })
})

describe('MetaWhatsAppChannel', () => {
  const fetchMock = jest.fn()
  const originalFetch = global.fetch
  const channel = new MetaWhatsAppChannel('meta-token', '123456789')

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  const sentBody = () =>
    JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>

  it('posts to the phone number id it was given', async () => {
    await expect(channel.send('+1 305 555 0100', 'Nueva reserva', 'Jane')).resolves.toBe(true)

    expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/123456789/messages')
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe(
      'Bearer meta-token',
    )
  })

  it('strips the number down to digits', async () => {
    // Meta rejects a `+` or a space in `to`, and the host types the number the
    // way they would dial it.
    await channel.send('+1 (305) 555-0100', 'Nueva reserva', 'Jane')

    expect(sentBody().to).toBe('13055550100')
  })

  it('keeps the subject as the first line, in bold', async () => {
    await channel.send('13055550100', 'Nueva reserva', 'Jane Doe')

    // The same shape as Twilio and Telegram: one recognisable format, whichever
    // provider woke the host up.
    expect((sentBody().text as { body: string }).body).toBe('*Nueva reserva*\n\nJane Doe')
  })

  it('throws with Meta’s own reason when it refuses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'Recipient phone number not in allowed list' } }),
    })

    await expect(channel.send('13055550100', 'Nueva reserva', 'Jane')).rejects.toThrow(
      'Recipient phone number not in allowed list',
    )
  })

  it('refuses a number with no digits rather than posting nowhere', async () => {
    await expect(channel.send('sin numero', 'Nueva reserva', 'Jane')).rejects.toThrow('number')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
