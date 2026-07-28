import { ConfigService } from '@nestjs/config'
import { TranslationService, hashSource } from './translation.service'
import type { PrismaService } from '../prisma/prisma.service'

/**
 * The two rules that keep automatic translation from going wrong quietly:
 * a stale translation must not be served, and a human's edit must not be
 * overwritten by the machine.
 */
const config = (key?: string) => ({ get: () => key }) as unknown as ConfigService

type PrismaMock = {
  translation: {
    findMany: jest.Mock
    findUnique: jest.Mock
    upsert: jest.Mock
    deleteMany: jest.Mock
  }
}

const prismaMock = (): PrismaMock => ({
  translation: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
})

describe('TranslationService', () => {
  let prisma: PrismaMock
  let service: TranslationService

  beforeEach(() => {
    prisma = prismaMock()
    service = new TranslationService(config('test-key'), prisma as unknown as PrismaService)
  })

  describe('localize', () => {
    const record = { id: 'r1', title: 'Hola mundo', icon: 'Star' }

    it('swaps in the translation when it matches the current source', () => {
      const map = new Map([
        ['r1:title', { text: 'Hello world', sourceHash: hashSource('Hola mundo') }],
      ])

      expect(service.localize(record, ['title'], map).title).toBe('Hello world')
    })

    it('falls back to the source when the source has changed since', () => {
      // The Spanish was edited after this translation was made. Showing it
      // would be showing a translation of text that no longer exists.
      const map = new Map([
        ['r1:title', { text: 'Hello world', sourceHash: hashSource('Otro texto') }],
      ])

      expect(service.localize(record, ['title'], map).title).toBe('Hola mundo')
    })

    it('falls back when there is no translation at all', () => {
      expect(service.localize(record, ['title'], new Map()).title).toBe('Hola mundo')
    })

    it('leaves fields that are not translatable alone', () => {
      const map = new Map([['r1:icon', { text: 'Estrella', sourceHash: hashSource('Star') }]])

      expect(service.localize(record, ['title'], map).icon).toBe('Star')
    })
  })

  describe('load', () => {
    it('does not query for the source language — that text is on the record', async () => {
      await service.load('ContentSection', ['a'], 'es')
      expect(prisma.translation.findMany).not.toHaveBeenCalled()
    })

    it('does not query for a language the site does not support', async () => {
      await service.load('ContentSection', ['a'], 'jp')
      expect(prisma.translation.findMany).not.toHaveBeenCalled()
    })

    it('fetches every requested record in one query', async () => {
      await service.load('ContentSection', ['a', 'b'], 'fr')
      expect(prisma.translation.findMany).toHaveBeenCalledTimes(1)
      expect(prisma.translation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entity: 'ContentSection', entityId: { in: ['a', 'b'] }, locale: 'fr' },
        }),
      )
    })
  })

  describe('syncRecord', () => {
    it('does nothing without an API key, rather than failing the save', async () => {
      const offline = new TranslationService(config(undefined), prisma as unknown as PrismaService)

      await offline.syncRecord('Review', { id: 'r1', text: 'Hola' }, ['text'])
      expect(prisma.translation.upsert).not.toHaveBeenCalled()
    })

    it('skips a translation a person has edited', async () => {
      prisma.translation.findUnique.mockResolvedValue({
        sourceHash: 'stale',
        isMachine: false,
      })

      await service.syncRecord('Review', { id: 'r1', text: 'Hola' }, ['text'])
      expect(prisma.translation.upsert).not.toHaveBeenCalled()
    })

    it('skips a machine translation that is already current', async () => {
      prisma.translation.findUnique.mockResolvedValue({
        sourceHash: hashSource('Hola'),
        isMachine: true,
      })

      await service.syncRecord('Review', { id: 'r1', text: 'Hola' }, ['text'])
      expect(prisma.translation.upsert).not.toHaveBeenCalled()
    })

    it('ignores empty fields', async () => {
      await service.syncRecord('Review', { id: 'r1', text: '   ' }, ['text'])
      expect(prisma.translation.findUnique).not.toHaveBeenCalled()
    })
  })
})
