import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  CMSPageSlug,
  type ContentItemKind,
  type ContentSectionKey,
  type Prisma,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  CreateContentItemDto,
  CreateFAQDto,
  CreateReviewDto,
  UpdateCMSPageDto,
  UpdateContentItemDto,
  UpdateContentSectionDto,
  UpdateFAQDto,
  UpdateGalleryImageDto,
  UpdateReviewDto,
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

  // --- Landing page sections -----------------------------------------------

  /**
   * All eight sections with their items. The guest site asks for one snapshot
   * of the page rather than eight round trips, so this is a single query.
   */
  listSections(onlyPublished = false) {
    return this.prisma.contentSection.findMany({
      where: onlyPublished ? { published: true } : undefined,
      include: {
        items: {
          where: onlyPublished ? { published: true } : undefined,
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { key: 'asc' },
    })
  }

  /**
   * Upsert, like pages: the eight keys are fixed, so a section the seed never
   * wrote is created on first save instead of erroring.
   *
   * Rejects a lone language. The DTO can't check this — it only sees optional
   * fields — but writing a Spanish title with no English one is exactly the
   * half-translated page CLAUDE.md forbids, so it has to be caught somewhere.
   */
  async updateSection(key: ContentSectionKey, dto: UpdateContentSectionDto) {
    const existing = await this.prisma.contentSection.findUnique({ where: { key } })
    this.assertLanguagePairs(dto, existing)

    return this.prisma.contentSection.upsert({
      where: { key },
      update: dto,
      create: { key, ...dto },
    })
  }

  // --- Landing page items --------------------------------------------------

  async createItem(dto: CreateContentItemDto) {
    const { sectionKey, ...data } = dto
    const section = await this.requireSection(sectionKey)
    const sortOrder = await this.nextItemSortOrder(section.id, dto.kind)

    return this.prisma.contentItem.create({
      data: { ...data, sectionId: section.id, sortOrder },
    })
  }

  async updateItem(id: string, dto: UpdateContentItemDto) {
    await this.requireItem(id)
    return this.prisma.contentItem.update({ where: { id }, data: dto })
  }

  async deleteItem(id: string) {
    await this.requireItem(id)
    await this.prisma.contentItem.delete({ where: { id } })
  }

  async reorderItems(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.contentItem.update({ where: { id }, data: { sortOrder: index } }),
      ),
    )
  }

  // --- Reviews -------------------------------------------------------------

  listReviews(onlyPublished = false) {
    return this.prisma.review.findMany({
      where: onlyPublished ? { published: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async createReview(dto: CreateReviewDto) {
    const sortOrder = await this.nextSortOrder('review')
    const review = await this.prisma.review.create({ data: { ...dto, sortOrder } })
    if (review.featured) await this.demoteOtherFeatured(review.id)
    return review
  }

  async updateReview(id: string, dto: UpdateReviewDto) {
    await this.requireReview(id)
    const review = await this.prisma.review.update({ where: { id }, data: dto })
    if (review.featured) await this.demoteOtherFeatured(review.id)
    return review
  }

  async deleteReview(id: string) {
    await this.requireReview(id)
    await this.prisma.review.delete({ where: { id } })
  }

  async reorderReviews(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.review.update({ where: { id }, data: { sortOrder: index } }),
      ),
    )
  }

  /** Only one review can sit in the big quote block, so promoting demotes. */
  private demoteOtherFeatured(keepId: string) {
    return this.prisma.review.updateMany({
      where: { featured: true, id: { not: keepId } },
      data: { featured: false },
    })
  }

  // --- helpers -------------------------------------------------------------

  /** `titleEs` filled with `titleEn` empty, and the reverse, are both rejected. */
  private assertLanguagePairs(
    dto: UpdateContentSectionDto,
    existing: { [key: string]: unknown } | null,
  ) {
    const pairs = ['eyebrow', 'title', 'subtitle', 'body', 'ctaLabel', 'statLabel'] as const

    for (const field of pairs) {
      const es = dto[`${field}Es`] ?? (existing?.[`${field}Es`] as string | undefined) ?? ''
      const en = dto[`${field}En`] ?? (existing?.[`${field}En`] as string | undefined) ?? ''
      if (Boolean(es.trim()) !== Boolean(en.trim())) {
        throw new BadRequestException(`"${field}" needs both languages or neither`)
      }
    }
  }

  private async requireSection(key: ContentSectionKey) {
    const section = await this.prisma.contentSection.findUnique({ where: { key } })
    if (!section) throw new NotFoundException(`Section "${key}" not found`)
    return section
  }

  private async requireItem(id: string) {
    const item = await this.prisma.contentItem.findUnique({ where: { id } })
    if (!item) throw new NotFoundException('Content item not found')
    return item
  }

  private async requireReview(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } })
    if (!review) throw new NotFoundException('Review not found')
    return review
  }

  /** Ordering is per list, not per section: badges and cards count separately. */
  private async nextItemSortOrder(sectionId: string, kind: ContentItemKind): Promise<number> {
    const last = await this.prisma.contentItem.findFirst({
      where: { sectionId, kind },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    return last ? last.sortOrder + 1 : 0
  }

  private async nextSortOrder(model: 'fAQ' | 'galleryImage' | 'review'): Promise<number> {
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
