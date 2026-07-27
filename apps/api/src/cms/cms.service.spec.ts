import { NotFoundException } from '@nestjs/common'
import { CMSPageSlug } from '@prisma/client'
import { CmsService } from './cms.service'
import type { PrismaService } from '../prisma/prisma.service'

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
      $transaction: jest.fn(async (operations: unknown[]) => operations),
    }
    service = new CmsService(prisma as unknown as PrismaService)
  })

  describe('pages', () => {
    it('creates the row when a slug is saved for the first time', async () => {
      // The twelve slugs are fixed by the domain, so saving one that has no row
      // yet must create it rather than 404.
      const dto = { titleEs: 'Políticas', titleEn: 'Policies', bodyEs: 'a', bodyEn: 'b' }
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
        questionEs: 'q',
        questionEn: 'q',
        answerEs: 'a',
        answerEn: 'a',
      } as Parameters<typeof service.createFaq>[0])

      expect(prisma.fAQ.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sortOrder: 5 }) }),
      )
    })

    it('starts at zero when there are no questions yet', async () => {
      prisma.fAQ.findFirst.mockResolvedValue(null)

      await service.createFaq({
        questionEs: 'q',
        questionEn: 'q',
        answerEs: 'a',
        answerEn: 'a',
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
})
