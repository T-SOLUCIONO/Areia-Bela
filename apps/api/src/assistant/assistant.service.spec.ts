import type { ConfigService } from '@nestjs/config'
import { AssistantService } from './assistant.service'
import type { CmsService } from '../cms/cms.service'
import type { PrismaService } from '../prisma/prisma.service'

const create = jest.fn()
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({ messages: { create: (...args: unknown[]) => create(...args) } })),
}))

const config = (env: Record<string, string> = {}) =>
  ({ get: (key: string) => env[key] }) as unknown as ConfigService

const CONTENT = {
  faqs: [
    { question: '¿Puedo llevar a mi mascota?', answer: 'Sí, con un cargo de $100 por estadía.' },
  ],
  pages: [{ title: 'Normas de la casa', body: 'No se permiten fiestas.' }],
  settings: { contactEmail: 'host@areiabela.com', contactPhone: '+17275553043' },
}

const PROPERTY = {
  maxGuests: 8,
  bedrooms: 3,
  bathrooms: 2,
  address: 'San Petersburgo, Florida',
  checkInTime: '16:00',
  checkOutTime: '10:00',
  minNights: 2,
  maxNights: 30,
  cancellationPolicy: 'MODERATE',
  cleaningFee: '150',
  additionalGuestFeePerNight: '25',
  trashCollectionDays: ['wednesday'],
  accessNotes: null,
  extras: [{ name: 'Piscina climatizada', price: '20', pricingType: 'PER_NIGHT' }],
}

const SETTINGS = { whatsapp: '17275553043', contactPhone: '+1 727 555 3043' }

describe('AssistantService', () => {
  let cms: { getLocalizedContent: jest.Mock }
  let prisma: {
    siteSettings: { findUnique: jest.Mock }
    property: { findFirst: jest.Mock }
  }

  const build = (env?: Record<string, string>) =>
    new AssistantService(
      config(env),
      cms as unknown as CmsService,
      prisma as unknown as PrismaService,
    )

  const KEY = { ANTHROPIC_API_KEY: 'sk-ant-test' }

  beforeEach(() => {
    jest.clearAllMocks()
    cms = { getLocalizedContent: jest.fn().mockResolvedValue(CONTENT) }
    prisma = {
      siteSettings: { findUnique: jest.fn().mockResolvedValue(SETTINGS) },
      property: { findFirst: jest.fn().mockResolvedValue(PROPERTY) },
    }
    create.mockResolvedValue({ content: [{ type: 'text', text: 'Sí, se admiten mascotas.' }] })
  })

  describe('whether it can answer at all', () => {
    it('reports itself unavailable without an API key', () => {
      expect(build().available).toBe(false)
      expect(build(KEY).available).toBe(true)
    })

    it('hands off instead of inventing an answer when there is no key', async () => {
      // A widget that apologises in the voice of the house reads as the house
      // refusing to help. Better to send the guest to a channel that works.
      const answer = await build().ask('¿La piscina es climatizada?', 'es')

      expect(answer.answer).toBe('')
      expect(answer.handoff).toBe(true)
      expect(answer.contact.whatsapp).toBe('17275553043')
      expect(create).not.toHaveBeenCalled()
    })

    it('hands off when the provider fails, rather than looking like an answer', async () => {
      create.mockRejectedValue(new Error('529 overloaded'))

      const answer = await build(KEY).ask('¿Hay wifi?', 'es')

      expect(answer.answer).toBe('')
      expect(answer.handoff).toBe(true)
    })
  })

  describe('what it is allowed to know', () => {
    const systemPrompt = () => (create.mock.calls[0][0] as { system: string }).system

    it('grounds the answer in the site’s own content, in the guest’s language', async () => {
      await build(KEY).ask('¿Puedo llevar a mi perro?', 'en')

      expect(cms.getLocalizedContent).toHaveBeenCalledWith('en')
      const prompt = systemPrompt()
      expect(prompt).toContain('¿Puedo llevar a mi mascota?')
      expect(prompt).toContain('No se permiten fiestas.')
      expect(prompt).toContain('8 huéspedes')
      expect(prompt).toContain('Piscina climatizada')
    })

    it('forbids inventing, quoting a total and confirming dates', async () => {
      // The three ways this feature could do real damage: a made-up fee, a total
      // the server never computed, and an availability promise the calendar does
      // not back. `CLAUDE.md` bans the first outright and makes the server the
      // only authority on the second.
      await build(KEY).ask('¿Cuánto cuesta una semana en agosto?', 'es')

      const prompt = systemPrompt()
      expect(prompt).toMatch(/NO la inventes/)
      expect(prompt).toMatch(/NUNCA calcules un total/)
      expect(prompt).toMatch(/NUNCA confirmes disponibilidad/)
      expect(prompt).toMatch(/NUNCA hagas reservas/)
    })

    it('caps the question and the history the browser sends', async () => {
      // The history is input, not memory: it is the part of the request whose
      // size a caller controls, and size is what a language model costs.
      const history = Array.from({ length: 20 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: 'x'.repeat(2000),
      }))

      await build(KEY).ask('y'.repeat(2000), 'es', history)

      const { messages } = create.mock.calls[0][0] as {
        messages: { role: string; content: string }[]
      }
      expect(messages).toHaveLength(7)
      for (const message of messages) expect(message.content.length).toBeLessThanOrEqual(500)
    })
  })

  describe('handing the guest to the host', () => {
    it('reports a handoff when the model says the content does not cover it', async () => {
      create.mockResolvedValue({
        content: [{ type: 'text', text: 'Eso lo confirma mejor Angélica. [[CONTACTAR]]' }],
      })

      const answer = await build(KEY).ask('¿Hay cuna para bebé?', 'es')

      expect(answer.handoff).toBe(true)
      // The marker is plumbing, not something a guest should ever read.
      expect(answer.answer).toBe('Eso lo confirma mejor Angélica.')
      expect(answer.answer).not.toContain('[[')
    })

    it('does not report a handoff for an ordinary answer', async () => {
      const answer = await build(KEY).ask('¿A qué hora es la entrada?', 'es')

      expect(answer.handoff).toBe(false)
      expect(answer.answer).toBe('Sí, se admiten mascotas.')
    })

    it('passes on the contact details the host typed, and nothing else', async () => {
      prisma.siteSettings.findUnique.mockResolvedValue({ whatsapp: '  ', contactPhone: '' })

      const answer = await build(KEY).ask('¿Hay parking?', 'es')

      // Empty is null, not an empty string dressed as a phone number: the widget
      // has to be able to tell "no channel" from "a channel with no digits".
      expect(answer.contact).toEqual({ whatsapp: null, phone: null })
    })
  })

  describe('which model it uses', () => {
    it('defaults to Sonnet and takes an override', async () => {
      await build(KEY).ask('¿Hay wifi?', 'es')
      expect((create.mock.calls[0][0] as { model: string }).model).toBe('claude-sonnet-5')

      create.mockClear()
      await build({ ...KEY, ASSISTANT_MODEL: 'claude-haiku-4-5-20251001' }).ask('¿Hay wifi?', 'es')
      // A public endpoint on a small business's bill: dropping to a cheaper model
      // should be one environment variable, not a code change.
      expect((create.mock.calls[0][0] as { model: string }).model).toBe('claude-haiku-4-5-20251001')
    })
  })
})
