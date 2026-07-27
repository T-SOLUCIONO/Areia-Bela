import { Injectable, NotFoundException } from '@nestjs/common'
import { CMSPageSlug, type Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreateFAQDto,
  UpdateCMSPageDto,
  UpdateFAQDto,
  UpdateGalleryImageDto,
  UpdateSiteSettingsDto,
} from './dto/cms.dto'

/** Pinned id, so the single settings row can be upserted without a lookup. */
const SETTINGS_ID = 'site'

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Pages ---------------------------------------------------------------

  listPages(onlyPublished = false) {
    return this.prisma.cMSPage.findMany({
      where: onlyPublished ? { published: true } : undefined,
      orderBy: { slug: 'asc' },
    })
  }

  async getPage(slug: CMSPageSlug) {
    const page = await this.prisma.cMSPage.findUnique({ where: { slug } })
    if (!page) throw new NotFoundException(`Page "${slug}" not found`)
    return page
  }

  /**
   * Upsert rather than update: the twelve slugs are fixed by the domain, so a
   * page that hasn't been written yet should be created on first save instead
   * of erroring.
   */
  updatePage(slug: CMSPageSlug, dto: UpdateCMSPageDto) {
    return this.prisma.cMSPage.upsert({
      where: { slug },
      update: dto,
      create: { slug, ...dto },
    })
  }

  // --- FAQs ----------------------------------------------------------------

  listFaqs(onlyPublished = false) {
    return this.prisma.fAQ.findMany({
      where: onlyPublished ? { published: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async createFaq(dto: CreateFAQDto) {
    // New entries land at the end unless a position is given.
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder('fAQ'))
    return this.prisma.fAQ.create({ data: { ...dto, sortOrder } })
  }

  async updateFaq(id: string, dto: UpdateFAQDto) {
    await this.requireFaq(id)
    return this.prisma.fAQ.update({ where: { id }, data: dto })
  }

  async deleteFaq(id: string) {
    await this.requireFaq(id)
    await this.prisma.fAQ.delete({ where: { id } })
  }

  // --- Gallery -------------------------------------------------------------

  listImages(onlyPublished = false) {
    return this.prisma.galleryImage.findMany({
      where: onlyPublished ? { published: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async addImage(input: { url: string; altEs: string; altEn: string }) {
    const sortOrder = await this.nextSortOrder('galleryImage')
    return this.prisma.galleryImage.create({ data: { ...input, sortOrder } })
  }

  async updateImage(id: string, dto: UpdateGalleryImageDto) {
    await this.requireImage(id)
    return this.prisma.galleryImage.update({ where: { id }, data: dto })
  }

  async deleteImage(id: string) {
    const image = await this.requireImage(id)
    await this.prisma.galleryImage.delete({ where: { id } })
    // Returned so the controller can drop the blob too — the row and the file
    // have to disappear together or the store fills with orphans.
    return image
  }

  /**
   * Persists a drag-and-drop reorder. One transaction, so the list can't be
   * left half-renumbered if something fails midway.
   */
  async reorderImages(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.galleryImage.update({ where: { id }, data: { sortOrder: index } }),
      ),
    )
    return this.listImages()
  }

  async reorderFaqs(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.fAQ.update({ where: { id }, data: { sortOrder: index } })),
    )
    return this.listFaqs()
  }

  // --- Site settings -------------------------------------------------------

  async getSettings() {
    return this.prisma.siteSettings.findUnique({ where: { id: SETTINGS_ID } })
  }

  updateSettings(dto: UpdateSiteSettingsDto) {
    return this.prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: dto,
      create: { id: SETTINGS_ID, ...dto },
    })
  }

  // --- helpers -------------------------------------------------------------

  private async nextSortOrder(model: 'fAQ' | 'galleryImage'): Promise<number> {
    const delegate = this.prisma[model] as {
      findFirst: (args: unknown) => Promise<{ sortOrder: number } | null>
    }
    const last = await delegate.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    return last ? last.sortOrder + 1 : 0
  }

  private async requireFaq(id: string) {
    const faq = await this.prisma.fAQ.findUnique({ where: { id } })
    if (!faq) throw new NotFoundException('FAQ not found')
    return faq
  }

  private async requireImage(id: string) {
    const image = await this.prisma.galleryImage.findUnique({ where: { id } })
    if (!image) throw new NotFoundException('Image not found')
    return image
  }
}

export type { Prisma }
