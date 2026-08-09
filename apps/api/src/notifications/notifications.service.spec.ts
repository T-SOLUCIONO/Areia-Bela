import { ConfigService } from '@nestjs/config'
import { NotificationsService } from './notifications.service'
import type { MailService } from '../mail/mail.service'
import type { PrismaService } from '../prisma/prisma.service'

const SETTINGS = {
  contactEmail: 'host@areiabela.com',
  whatsapp: '17275553043',
  notifyEmail: '',
  notifyWhatsapp: '',
  notifyTelegram: '',
  whatsappProvider: 'TWILIO' as const,
  notifyOnBooking: true,
  notifyOnCancel: true,
  notifyOnChange: true,
  notifyOnMessage: true,
}

const BOOKING = {
  reference: 'AB-1234',
  guestName: 'Jane',
  guestEmail: 'jane@example.com',
  checkIn: '2026-09-01',
  checkOut: '2026-09-08',
  nights: 7,
  guests: 4,
  total: 2483,
}

const config = (env: Record<string, string> = {}) =>
  ({ get: (key: string) => env[key] }) as unknown as ConfigService

const TWILIO = {
  TWILIO_ACCOUNT_SID: 'AC123',
  TWILIO_AUTH_TOKEN: 'token',
  TWILIO_WHATSAPP_FROM: '+14155238886',
}

describe('NotificationsService', () => {
  let prisma: { siteSettings: { findUnique: jest.Mock } }
  let mail: { send: jest.Mock }
  let fetchMock: jest.Mock

  const build = (env?: Record<string, string>) =>
    new NotificationsService(
      prisma as unknown as PrismaService,
      config(env),
      mail as unknown as MailService,
    )

  beforeEach(() => {
    prisma = { siteSettings: { findUnique: jest.fn().mockResolvedValue({ ...SETTINGS }) } }
    mail = { send: jest.fn().mockResolvedValue(undefined) }
    fetchMock = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  describe('where alerts go', () => {
    it('falls back to the public address when no alert address is set', async () => {
      await build().bookingCreated(BOOKING)
      expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'host@areiabela.com' }))
    })

    it('prefers the alert address over the public one', async () => {
      // The address a guest writes to is rarely the one the host wants woken
      // up at, which is why these are two fields.
      prisma.siteSettings.findUnique.mockResolvedValue({
        ...SETTINGS,
        notifyEmail: 'angelica@personal.com',
      })

      await build().bookingCreated(BOOKING)
      expect(mail.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'angelica@personal.com' }),
      )
    })

    it('sends nothing when the host switched that event off', async () => {
      prisma.siteSettings.findUnique.mockResolvedValue({ ...SETTINGS, notifyOnBooking: false })

      await build().bookingCreated(BOOKING)
      expect(mail.send).not.toHaveBeenCalled()
    })

    it('leaves the other events alone when one is switched off', async () => {
      prisma.siteSettings.findUnique.mockResolvedValue({ ...SETTINGS, notifyOnBooking: false })

      await build().messageReceived({ name: 'Jane', email: 'j@e.com', message: 'Hola' })
      expect(mail.send).toHaveBeenCalled()
    })

    it('does not reach for WhatsApp without credentials', async () => {
      await build().bookingCreated(BOOKING)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(mail.send).toHaveBeenCalled()
    })

    it('sends over both channels when both are set up', async () => {
      await build(TWILIO).bookingCreated(BOOKING)

      expect(mail.send).toHaveBeenCalled()
      expect(fetchMock.mock.calls[0][0]).toContain('api.twilio.com')
    })
  })

  describe('failures', () => {
    it('does not throw when a channel fails', async () => {
      // The guest paid and the dates are held. Reporting an error because an
      // alert bounced would undo a booking that actually succeeded.
      mail.send.mockRejectedValue(new Error('SMTP down'))
      await expect(build().bookingCreated(BOOKING)).resolves.toBeUndefined()
    })

    it('still emails when WhatsApp fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'bad number' }),
      })

      await build(TWILIO).bookingCreated(BOOKING)
      expect(mail.send).toHaveBeenCalled()
    })

    it('does nothing at all when the settings row is missing', async () => {
      prisma.siteSettings.findUnique.mockResolvedValue(null)
      await expect(build().bookingCreated(BOOKING)).resolves.toBeUndefined()
      expect(mail.send).not.toHaveBeenCalled()
    })
  })

  describe('what the message says', () => {
    it('leads with who, when and how much', async () => {
      await build().bookingCreated({ ...BOOKING, extras: ['Mascota'], note: 'Llegamos tarde' })
      const { subject, text } = mail.send.mock.calls[0][0] as { subject: string; text: string }

      expect(subject).toContain('2026-09-01')
      expect(text).toContain('Jane')
      expect(text).toContain('$2483')
      expect(text).toContain('Mascota')
      expect(text).toContain('Llegamos tarde')
      // The address to reply to has to be in there, or the alert is a dead end.
      expect(text).toContain('jane@example.com')
    })

    it('says the dates are free again when a booking is cancelled', async () => {
      await build().bookingCancelled(BOOKING, 'Cambio de planes')
      const { text } = mail.send.mock.calls[0][0] as { text: string }

      expect(text).toContain('Cambio de planes')
      expect(text).toContain('libres')
    })
  })

  describe('status', () => {
    it('reports email on and the rest off without credentials', async () => {
      await expect(build().status()).resolves.toEqual({
        email: true,
        whatsapp: false,
        whatsappProvider: 'TWILIO',
        whatsappConfigured: false,
        twilioConfigured: false,
        metaConfigured: false,
        metaProblem: null,
        telegram: false,
        telegramConfigured: false,
      })
    })

    it('reports WhatsApp on once both a number and credentials exist', async () => {
      await expect(build(TWILIO).status()).resolves.toMatchObject({
        whatsapp: true,
        whatsappConfigured: true,
      })
    })

    it('separates “no chat id” from “no bot token”', async () => {
      // Two different problems with two different owners: the host can add a
      // chat id, and only a deploy can add the token. One flag for both would
      // send them looking in the wrong place.
      prisma.siteSettings.findUnique.mockResolvedValue({ ...SETTINGS, notifyTelegram: '' })
      await expect(build({ TELEGRAM_BOT_TOKEN: 'bot-token' }).status()).resolves.toMatchObject({
        telegram: false,
        telegramConfigured: true,
      })

      prisma.siteSettings.findUnique.mockResolvedValue({ ...SETTINGS, notifyTelegram: '12345' })
      await expect(build({ TELEGRAM_BOT_TOKEN: 'bot-token' }).status()).resolves.toMatchObject({
        telegram: true,
        telegramConfigured: true,
      })
    })
  })

  describe('whether Meta still accepts the token', () => {
    const META = {
      META_WHATSAPP_TOKEN: 'meta-token',
      META_WHATSAPP_PHONE_NUMBER_ID: '123456789',
    }

    const metaSays = (body: unknown, ok = false) =>
      fetchMock.mockResolvedValue({
        ok,
        statusText: 'Bad Request',
        json: () => Promise.resolve(body),
      })

    it('passes on Meta’s own sentence when the token is dead', async () => {
      // The real failure: a booking came in, the log said "Authentication
      // Error", and the panel showed WhatsApp as configured because the
      // environment variable was still there. Presence is not validity — Meta's
      // dashboard token lasts a day and dies on its own.
      metaSays({
        error: { message: 'Error validating access token: Session has expired on 06-Aug-26.' },
      })

      await expect(build(META).status()).resolves.toMatchObject({
        metaConfigured: true,
        metaProblem: 'Error validating access token: Session has expired on 06-Aug-26.',
      })
    })

    it('reports no problem when Meta accepts it', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: '123456789' }) })

      await expect(build(META).status()).resolves.toMatchObject({ metaProblem: null })
    })

    it('stays quiet when Meta could not be reached at all', async () => {
      // Not being able to ask is not evidence against the token. A warning that
      // shows up whenever the network blinks is one the host stops reading.
      fetchMock.mockRejectedValue(new Error('ENOTFOUND graph.facebook.com'))

      await expect(build(META).status()).resolves.toMatchObject({ metaProblem: null })
    })

    it('asks Meta once, not on every load of the screen', async () => {
      metaSays({ error: { message: 'Authentication Error' } })
      const service = build(META)

      await service.status()
      await service.status()
      await service.status()

      const checks = fetchMock.mock.calls.filter(([url]) =>
        String(url).startsWith('https://graph.facebook.com'),
      )
      expect(checks).toHaveLength(1)
    })

    it('does not call Meta when Meta is not configured', async () => {
      await build(TWILIO).status()

      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('choosing a WhatsApp provider', () => {
    const META = {
      META_WHATSAPP_TOKEN: 'meta-token',
      META_WHATSAPP_PHONE_NUMBER_ID: '123456789',
    }

    it('uses Meta when Meta is chosen', async () => {
      prisma.siteSettings.findUnique.mockResolvedValue({
        ...SETTINGS,
        notifyWhatsapp: '13055550100',
        whatsappProvider: 'META',
      })

      await expect(build(META).status()).resolves.toMatchObject({
        whatsapp: true,
        whatsappProvider: 'META',
        whatsappConfigured: true,
      })
    })

    it('does not quietly fall back to the other provider', async () => {
      // Choosing Meta and getting Twilio would mean the panel says one thing
      // and the phone shows another, with no reason for anyone to look.
      prisma.siteSettings.findUnique.mockResolvedValue({
        ...SETTINGS,
        notifyWhatsapp: '13055550100',
        whatsappProvider: 'META',
      })

      await expect(build(TWILIO).status()).resolves.toMatchObject({
        whatsapp: false,
        whatsappConfigured: false,
        // Reported separately, so the panel can say Twilio is there to switch to
        // rather than only that the current choice is broken.
        twilioConfigured: true,
        metaConfigured: false,
      })
    })

    it('reports both when both are configured', async () => {
      await expect(build({ ...TWILIO, ...META }).status()).resolves.toMatchObject({
        twilioConfigured: true,
        metaConfigured: true,
      })
    })
  })
})
