import { NotFoundException } from '@nestjs/common'
import { CMSPageSlug, ContentItemKind, ContentSectionKey } from '@prisma/client'
import { CmsService } from './cms.service'
import type { TranslationService } from './translation.service'
import type { PrismaService } from '../prisma/prisma.service'

/**
 * Translation is exercised in translation.service.spec.ts. Here it is stubbed
 * so these tests stay about the CMS: what gets saved and in what order.
 */
const translationsStub = () =>
  ({
    load: jest.fn().mockResolvedValue(new Map()),
    localize: <T>(record: T) => record,
    syncRecord: jest.fn().mockResolvedValue(undefined),
    forget: jest.fn().mockResolvedValue(undefined),
  }) as unknown as TranslationService

/**
 * Covers the behaviour that isn't just a Prisma call passed through: the
 * upsert-on-first-save for pages, where new rows land in the sort order, and
 * that reordering happens in one transaction.
 */
type Delegate = {
  findUnique: jest.Mock
  findFirst: jest.Mock
  findMany: jest.Mock
  create: jest.Mock
  update: jest.Mock
  delete: jest.Mock
  upsert: jest.Mock
}

type PrismaMock = {
  cMSPage: Delegate
  fAQ: Delegate
  galleryImage: Delegate
  siteSettings: Delegate
  contentSection: Delegate
  contentItem: Delegate
  review: Delegate & { updateMany: jest.Mock }
  $transaction: jest.Mock
}

const delegate = (): Delegate => ({
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
})

describe('CmsService', () => {
  let prisma: PrismaMock
  let service: CmsService

  beforeEach(() => {
    prisma = {
      cMSPage: delegate(),
      fAQ: delegate(),
      galleryImage: delegate(),
      siteSettings: delegate(),
      contentSection: delegate(),
      contentItem: delegate(),
      review: { ...delegate(), updateMany: jest.fn() },
      $transaction: jest.fn(async (operations: unknown[]) => operations),
    }
    service = new CmsService(prisma as unknown as PrismaService, translationsStub())
  })

  describe('pages', () => {
    it('creates the row when a slug is saved for the first time', async () => {
      // The twelve slugs are fixed by the domain, so saving one that has no row
      // yet must create it rather than 404.
      const dto = { title: 'Políticas', body: 'a' }
      await service.updatePage(CMSPageSlug.POLICIES, dto)

      expect(prisma.cMSPage.upsert).toHaveBeenCalledWith({
        where: { slug: CMSPageSlug.POLICIES },
        update: dto,
        create: { slug: CMSPageSlug.POLICIES, ...dto },
      })
    })

    it('hides unpublished pages from the guest site', async () => {
      await service.listPages(true)
      expect(prisma.cMSPage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { published: true } }),
      )
    })

    it('shows unpublished pages to the editor', async () => {
      await service.listPages()
      expect(prisma.cMSPage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      )
    })

    it('404s on a page that was never written', async () => {
      prisma.cMSPage.findUnique.mockResolvedValue(null)
      await expect(service.getPage(CMSPageSlug.POLICIES)).rejects.toThrow(NotFoundException)
    })
  })

  describe('faqs', () => {
    it('puts a new question at the end of the list', async () => {
      prisma.fAQ.findFirst.mockResolvedValue({ sortOrder: 4 })

      await service.createFaq({
        question: 'q',
        answer: 'a',
      } as Parameters<typeof service.createFaq>[0])

      expect(prisma.fAQ.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sortOrder: 5 }) }),
      )
    })

    it('starts at zero when there are no questions yet', async () => {
      prisma.fAQ.findFirst.mockResolvedValue(null)

      await service.createFaq({
        question: 'q',
        answer: 'a',
      } as Parameters<typeof service.createFaq>[0])

      expect(prisma.fAQ.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sortOrder: 0 }) }),
      )
    })

    it('refuses to delete a question that does not exist', async () => {
      prisma.fAQ.findUnique.mockResolvedValue(null)
      await expect(service.deleteFaq('missing')).rejects.toThrow(NotFoundException)
      expect(prisma.fAQ.delete).not.toHaveBeenCalled()
    })

    it('renumbers the whole list in one transaction', async () => {
      await service.reorderFaqs(['c', 'a', 'b'])

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(prisma.fAQ.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'c' },
        data: { sortOrder: 0 },
      })
      expect(prisma.fAQ.update).toHaveBeenNthCalledWith(3, {
        where: { id: 'b' },
        data: { sortOrder: 2 },
      })
    })
  })

  describe('gallery', () => {
    it('returns the deleted row so the stored file can be dropped too', async () => {
      const image = { id: 'i1', url: 'https://blob/x.jpg' }
      prisma.galleryImage.findUnique.mockResolvedValue(image)

      await expect(service.deleteImage('i1')).resolves.toBe(image)
      expect(prisma.galleryImage.delete).toHaveBeenCalledWith({ where: { id: 'i1' } })
    })

    it('does not delete anything when the image is unknown', async () => {
      prisma.galleryImage.findUnique.mockResolvedValue(null)
      await expect(service.deleteImage('nope')).rejects.toThrow(NotFoundException)
      expect(prisma.galleryImage.delete).not.toHaveBeenCalled()
    })

    it('reorders in one transaction', async () => {
      await service.reorderImages(['b', 'a'])
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(prisma.galleryImage.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'b' },
        data: { sortOrder: 0 },
      })
    })
  })

  describe('site settings', () => {
    it('always writes the same single row', async () => {
      const dto = { contactEmail: 'a@b.c' } as Parameters<typeof service.updateSettings>[0]
      await service.updateSettings(dto)

      expect(prisma.siteSettings.upsert).toHaveBeenCalledWith({
        where: { id: 'site' },
        update: dto,
        create: { id: 'site', ...dto },
      })
    })
  })

  describe('landing sections', () => {
    it('creates the row when a section is saved for the first time', async () => {
      prisma.contentSection.findUnique.mockResolvedValue(null)
      const dto = { title: 'Hola' }

      await service.updateSection(ContentSectionKey.HERO, dto)

      expect(prisma.contentSection.upsert).toHaveBeenCalledWith({
        where: { key: ContentSectionKey.HERO },
        update: dto,
        create: { key: ContentSectionKey.HERO, ...dto },
      })
    })
  })

  describe('landing items', () => {
    it('numbers a new item per list, not per section', async () => {
      // Two lists live in the same section; adding a badge must not be pushed
      // to the end by the cards that came before it.
      prisma.contentSection.findUnique.mockResolvedValue({ id: 's1' })
      prisma.contentItem.findFirst.mockResolvedValue({ sortOrder: 2 })

      await service.createItem({
        sectionKey: ContentSectionKey.HERO,
        kind: ContentItemKind.HERO_BADGE,
        label: 'a',
      })

      expect(prisma.contentItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sectionId: 's1', kind: ContentItemKind.HERO_BADGE } }),
      )
      expect(prisma.contentItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sectionId: 's1', sortOrder: 3 }),
      })
    })

    it('404s when the section does not exist', async () => {
      prisma.contentSection.findUnique.mockResolvedValue(null)

      await expect(
        service.createItem({
          sectionKey: ContentSectionKey.HERO,
          kind: ContentItemKind.HERO_BADGE,
          label: 'a',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('renumbers in one transaction', async () => {
      await service.reorderItems(['b', 'a'])
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(prisma.contentItem.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'b' },
        data: { sortOrder: 0 },
      })
    })
  })

  describe('reviews', () => {
    it('demotes the previous highlight when another is promoted', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r2' })
      prisma.review.update.mockResolvedValue({ id: 'r2', featured: true })

      await service.updateReview('r2', { featured: true })

      expect(prisma.review.updateMany).toHaveBeenCalledWith({
        where: { featured: true, id: { not: 'r2' } },
        data: { featured: false },
      })
    })

    it('leaves the others alone when the saved review is not highlighted', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r3' })
      prisma.review.update.mockResolvedValue({ id: 'r3', featured: false })

      await service.updateReview('r3', { text: 'x' })
      expect(prisma.review.updateMany).not.toHaveBeenCalled()
    })

    it('refuses to delete one that does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null)
      await expect(service.deleteReview('nope')).rejects.toThrow(NotFoundException)
      expect(prisma.review.delete).not.toHaveBeenCalled()
    })
  })
})
