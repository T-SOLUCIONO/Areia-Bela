import { Logger } from '@nestjs/common'
import {
  EmailChannel,
  MetaWhatsAppChannel,
  TelegramChannel,
  asTemplateParameter,
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

const PDF = {
  filename: 'areia-bela-AB-1234.pdf',
  content: Buffer.from('%PDF-1.4 fake'),
  contentType: 'application/pdf',
}

describe('TelegramChannel with a file', () => {
  const fetchMock = jest.fn()
  const originalFetch = global.fetch
  const channel = new TelegramChannel('bot-token')

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  const form = (call = 0) => fetchMock.mock.calls[call][1].body as FormData

  it('sends it as a document rather than a message', async () => {
    await expect(channel.send('12345', 'Nueva reserva', 'Jane')).resolves.toBe(true)
    expect(fetchMock.mock.calls[0][0]).toContain('/sendMessage')

    fetchMock.mockClear()
    await expect(channel.send('12345', 'Nueva reserva', 'Jane', PDF)).resolves.toBe(true)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.telegram.org/botbot-token/sendDocument')
  })

  it('keeps the alert as the caption, so the file arrives with its context', async () => {
    await channel.send('12345', 'Nueva reserva', 'Jane Doe', PDF)

    const body = form()
    expect(body.get('chat_id')).toBe('12345')
    expect(body.get('caption')).toBe('*Nueva reserva*\n\nJane Doe')
    expect(body.get('parse_mode')).toBe('MarkdownV2')
    expect((body.get('document') as File).name).toBe('areia-bela-AB-1234.pdf')
  })

  it('does not set Content-Type by hand', async () => {
    // `fetch` has to add the multipart boundary; setting the header here produces
    // a body Telegram cannot parse.
    await channel.send('12345', 'Nueva reserva', 'Jane', PDF)

    expect(fetchMock.mock.calls[0][1].headers).toBeUndefined()
  })

  it('splits a long alert instead of letting Telegram truncate the caption', async () => {
    // Captions cap at 1024 where a message allows 4096, and Telegram cuts the
    // difference without saying so. Two messages beat a silently clipped one.
    await channel.send('12345', 'Nueva reserva', 'x'.repeat(1200), PDF)

    expect(fetchMock.mock.calls).toHaveLength(2)
    expect(fetchMock.mock.calls[0][0]).toContain('/sendMessage')
    expect(fetchMock.mock.calls[1][0]).toContain('/sendDocument')
    expect(form(1).get('caption')).toBeNull()
  })

  it('reports Telegram’s own reason when the upload fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ description: 'file is too big' }),
    })

    await expect(channel.send('12345', 'Nueva reserva', 'Jane', PDF)).rejects.toThrow(
      'file is too big',
    )
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

  describe('sending as an approved template', () => {
    const templated = new MetaWhatsAppChannel('meta-token', '123456789', {
      name: 'areia_bela_aviso',
      language: 'es',
    })

    it('sends the template instead of free text', async () => {
      // The whole reason this exists: free text only arrives inside a window the
      // recipient opened, so a booking at 3am never reaches the host. A template
      // is the only business-initiated message Meta delivers.
      await templated.send('13055550100', 'Nueva reserva · 2026-08-10', 'Jane · 4 huéspedes')

      const body = sentBody()
      expect(body.type).toBe('template')
      expect(body.text).toBeUndefined()
      expect(body.template).toMatchObject({
        name: 'areia_bela_aviso',
        language: { code: 'es' },
      })
    })

    it('passes the title and the summary as the two body parameters, in order', async () => {
      await templated.send('13055550100', 'Nueva reserva · 2026-08-10', 'Jane · 4 huéspedes')

      const template = sentBody().template as {
        components: { type: string; parameters: { type: string; text: string }[] }[]
      }
      expect(template.components).toHaveLength(1)
      expect(template.components[0].type).toBe('body')
      expect(template.components[0].parameters).toEqual([
        { type: 'text', text: 'Nueva reserva · 2026-08-10' },
        { type: 'text', text: 'Jane · 4 huéspedes' },
      ])
    })

    it('flattens the multi-line body Meta would reject', async () => {
      // Every alert in this service is built as lines. A parameter containing a
      // newline fails the whole send, so the layout has to live in the approved
      // text and the data has to arrive on one line.
      await templated.send(
        '13055550100',
        'Nueva reserva',
        'Jane · 4 huéspedes\n2026-09-01 → 2026-09-08\n\nTotal: $2483',
      )

      const parameters = (
        sentBody().template as { components: { parameters: { text: string }[] }[] }
      ).components[0].parameters
      expect(parameters[1].text).toBe('Jane · 4 huéspedes · 2026-09-01 → 2026-09-08 · Total: $2483')
      expect(parameters[1].text).not.toContain('\n')
    })

    it('still sends free text when no template is configured', async () => {
      // Development and the sandbox both work this way, and inside an open
      // window free text is richer. Absence of a template is not an error.
      await channel.send('13055550100', 'Nueva reserva', 'Jane')

      expect(sentBody().type).toBe('text')
    })
  })

  describe('asTemplateParameter', () => {
    it('removes every character Meta refuses', () => {
      // Newlines, tabs and runs of more than four spaces each reject the entire
      // message rather than being cleaned up on Meta's side.
      const cleaned = asTemplateParameter('uno\n\ndos\tres     cuatro')

      expect(cleaned).not.toMatch(/[\n\t]/)
      expect(cleaned).not.toMatch(/\s{2,}/)
    })

    it('cuts a parameter that is too long instead of losing the alert', () => {
      // A guest note can be any length. Over the limit Meta rejects the send, and
      // a truncated alert beats no alert.
      const cleaned = asTemplateParameter('x'.repeat(2000))

      expect(cleaned).toHaveLength(1024)
      expect(cleaned.endsWith('…')).toBe(true)
    })
  })

  describe('sending a file', () => {
    const uploaded = (id = 'media-99') =>
      fetchMock.mockImplementation((url: string) =>
        Promise.resolve(
          String(url).endsWith('/media')
            ? { ok: true, status: 200, json: () => Promise.resolve({ id }) }
            : { ok: true, status: 200, json: () => Promise.resolve({}) },
        ),
      )

    it('uploads the file first and sends the id it gets back', async () => {
      // Uploaded, not linked: the booking PDF has the guest's name, dates and
      // total in it, and making that publicly readable to send it to one person
      // is the wrong trade.
      uploaded('media-99')

      await expect(channel.send('13055550100', 'Nueva reserva', 'Jane', PDF)).resolves.toBe(true)

      expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v21.0/123456789/media')
      const upload = fetchMock.mock.calls[0][1].body as FormData
      expect(upload.get('messaging_product')).toBe('whatsapp')
      expect((upload.get('file') as File).name).toBe('areia-bela-AB-1234.pdf')

      const message = JSON.parse(fetchMock.mock.calls[1][1].body as string)
      expect(message.type).toBe('document')
      expect(message.document).toMatchObject({
        id: 'media-99',
        filename: 'areia-bela-AB-1234.pdf',
        caption: '*Nueva reserva*\n\nJane',
      })
    })

    it('does not send a message at all when the upload fails', async () => {
      // A document message with no media id is not worth sending, and Meta's
      // reason for refusing the file is the useful one.
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: { message: 'Unsupported file type' } }),
      })

      await expect(channel.send('13055550100', 'Nueva reserva', 'Jane', PDF)).rejects.toThrow(
        'Unsupported file type',
      )
      expect(fetchMock.mock.calls).toHaveLength(1)
    })

    it('uses the document template when one is approved, with the file in the header', async () => {
      // The whole point: a free-form document only arrives inside an open window,
      // and a template's header type is fixed at approval — so the file needs its
      // own template, separate from the text one.
      const templated = new MetaWhatsAppChannel('meta-token', '123456789', {
        name: 'areia_bela_aviso',
        documentName: 'areia_bela_aviso_pdf',
        language: 'es',
      })
      uploaded('media-77')

      await templated.send('13055550100', 'Nueva reserva', 'Jane', PDF)

      const message = JSON.parse(fetchMock.mock.calls[1][1].body as string)
      expect(message.type).toBe('template')
      expect(message.template.name).toBe('areia_bela_aviso_pdf')
      expect(message.template.components[0]).toEqual({
        type: 'header',
        parameters: [
          { type: 'document', document: { id: 'media-77', filename: 'areia-bela-AB-1234.pdf' } },
        ],
      })
      expect(message.template.components[1].parameters).toEqual([
        { type: 'text', text: 'Nueva reserva' },
        { type: 'text', text: 'Jane' },
      ])
    })

    it('drops the file rather than the alert when only the text template is approved', async () => {
      // The priority that matters, and it was backwards at first: an attachment
      // used to win unconditionally, which sent the booking alert as a free-form
      // document — dropped by Meta outside an open window — instead of as the
      // approved template, which always arrives. Adding the PDF could therefore
      // stop the host being told a booking came in.
      const templated = new MetaWhatsAppChannel('meta-token', '123456789', {
        name: 'areia_bela_aviso',
        language: 'es',
      })
      uploaded()

      await templated.send('13055550100', 'Nueva reserva', 'Jane', PDF)

      // Not even uploaded: there is nowhere for it to go.
      expect(fetchMock.mock.calls).toHaveLength(1)
      const message = JSON.parse(fetchMock.mock.calls[0][1].body as string)
      expect(message.type).toBe('template')
      expect(message.template.name).toBe('areia_bela_aviso')
    })

    it('sends a free-form document when no template is configured at all', async () => {
      // No worse than the free text it replaces: both need an open window.
      uploaded()

      await channel.send('13055550100', 'Nueva reserva', 'Jane', PDF)

      expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).type).toBe('document')
    })

    it('uses the document template even when the text one is not configured', async () => {
      // The reverse coupling, which would be just as invisible: no text template
      // must not disable the file one.
      const templated = new MetaWhatsAppChannel('meta-token', '123456789', {
        documentName: 'areia_bela_aviso_pdf',
        language: 'es',
      })
      uploaded()

      await templated.send('13055550100', 'Nueva reserva', 'Jane', PDF)

      const message = JSON.parse(fetchMock.mock.calls[1][1].body as string)
      expect(message.template.name).toBe('areia_bela_aviso_pdf')
    })
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
