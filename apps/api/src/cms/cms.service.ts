import { Injectable, NotFoundException } from '@nestjs/common'
import {
  CMSPageSlug,
  type ContentItemKind,
  type ContentSectionKey,
  type Prisma,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { TranslationService } from './translation.service'
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

/**
 * Which fields of each model hold prose the guest reads, and therefore need
 * translating. Everything else — prices, icons, URLs, dates — reads the same in
 * every language and must never be sent to a translator.
 */
const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id)

export const TRANSLATABLE = {
  CMSPage: ['title', 'body'],
  FAQ: ['question', 'answer'],
  GalleryImage: ['alt'],
  SiteSettings: ['seoTitle', 'seoDescription'],
  ContentSection: ['eyebrow', 'title', 'subtitle', 'body', 'ctaLabel', 'statLabel'],
  ContentItem: ['label', 'body'],
  Review: ['text', 'stayedAt'],
} as const

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translations: TranslationService,
  ) {}

  // --- Localized reads -------------------------------------------------------

  /**
   * The whole guest site in one language.
   *
   * Every list is fetched, then its translations are fetched in one query per
   * model and swapped in. Six queries for the page rather than one per field,
   * and no call to a translation model at request time — the text is already
   * stored.
   */
  async getLocalizedContent(locale: string) {
    const [pages, sections, reviews, faqs, images, settings] = await Promise.all([
      this.listPages(true),
      this.listSections(true),
      this.listReviews(true),
      this.listFaqs(true),
      this.listImages(true),
      this.getSettings(),
    ])

    // Items live inside their section but translate as their own entity.
    const items = sections.flatMap((section) => section.items)

    const [pageT, sectionT, itemT, reviewT, faqT, imageT, settingsT] = await Promise.all([
      this.translations.load('CMSPage', ids(pages), locale),
      this.translations.load('ContentSection', ids(sections), locale),
      this.translations.load('ContentItem', ids(items), locale),
      this.translations.load('Review', ids(reviews), locale),
      this.translations.load('FAQ', ids(faqs), locale),
      this.translations.load('GalleryImage', ids(images), locale),
      this.translations.load('SiteSettings', settings ? [settings.id] : [], locale),
    ])

    return {
      pages: pages.map((page) => this.translations.localize(page, TRANSLATABLE.CMSPage, pageT)),
      sections: sections.map((section) => ({
        ...this.translations.localize(section, TRANSLATABLE.ContentSection, sectionT),
        items: section.items.map((item) =>
          this.translations.localize(item, TRANSLATABLE.ContentItem, itemT),
        ),
      })),
      reviews: reviews.map((review) =>
        this.translations.localize(review, TRANSLATABLE.Review, reviewT),
      ),
      faqs: faqs.map((faq) => this.translations.localize(faq, TRANSLATABLE.FAQ, faqT)),
      images: images.map((image) =>
        this.translations.localize(image, TRANSLATABLE.GalleryImage, imageT),
      ),
      settings: settings
        ? this.translations.localize(settings, TRANSLATABLE.SiteSettings, settingsT)
        : null,
    }
  }

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
  async updatePage(slug: CMSPageSlug, dto: UpdateCMSPageDto) {
    const page = await this.prisma.cMSPage.upsert({
      where: { slug },
      update: dto,
      create: { slug, ...dto },
    })
    await this.retranslate('CMSPage', page, TRANSLATABLE.CMSPage)
    return page
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
    const faq = await this.prisma.fAQ.create({ data: { ...dto, sortOrder } })
    await this.retranslate('FAQ', faq, TRANSLATABLE.FAQ)
    return faq
  }

  async updateFaq(id: string, dto: UpdateFAQDto) {
    await this.requireFaq(id)
    const faq = await this.prisma.fAQ.update({ where: { id }, data: dto })
    await this.retranslate('FAQ', faq, TRANSLATABLE.FAQ)
    return faq
  }

  async deleteFaq(id: string) {
    await this.requireFaq(id)
    await this.prisma.fAQ.delete({ where: { id } })
    await this.translations.forget('FAQ', id)
  }

  // --- Gallery -------------------------------------------------------------

  listImages(onlyPublished = false) {
    return this.prisma.galleryImage.findMany({
      where: onlyPublished ? { published: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async addImage(input: { url: string; alt: string }) {
    const sortOrder = await this.nextSortOrder('galleryImage')
    return this.prisma.galleryImage.create({ data: { ...input, sortOrder } })
  }

  async updateImage(id: string, dto: UpdateGalleryImageDto) {
    await this.requireImage(id)
    const image = await this.prisma.galleryImage.update({ where: { id }, data: dto })
    await this.retranslate('GalleryImage', image, TRANSLATABLE.GalleryImage)
    return image
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

  async updateSettings(dto: UpdateSiteSettingsDto) {
    const settings = await this.prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      update: dto,
      create: { id: SETTINGS_ID, ...dto },
    })
    await this.retranslate('SiteSettings', settings, TRANSLATABLE.SiteSettings)
    return settings
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
   */
  async updateSection(key: ContentSectionKey, dto: UpdateContentSectionDto) {
    const section = await this.prisma.contentSection.upsert({
      where: { key },
      update: dto,
      create: { key, ...dto },
    })
    await this.retranslate('ContentSection', section, TRANSLATABLE.ContentSection)
    return section
  }

  // --- Landing page items --------------------------------------------------

  async createItem(dto: CreateContentItemDto) {
    const { sectionKey, ...data } = dto
    const section = await this.requireSection(sectionKey)
    const sortOrder = await this.nextItemSortOrder(section.id, dto.kind)

    const item = await this.prisma.contentItem.create({
      data: { ...data, sectionId: section.id, sortOrder },
    })
    await this.retranslate('ContentItem', item, TRANSLATABLE.ContentItem)
    return item
  }

  async updateItem(id: string, dto: UpdateContentItemDto) {
    await this.requireItem(id)
    const item = await this.prisma.contentItem.update({ where: { id }, data: dto })
    await this.retranslate('ContentItem', item, TRANSLATABLE.ContentItem)
    return item
  }

  async deleteItem(id: string) {
    await this.requireItem(id)
    await this.prisma.contentItem.delete({ where: { id } })
    await this.translations.forget('ContentItem', id)
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
    await this.retranslate('Review', review, TRANSLATABLE.Review)
    return review
  }

  async updateReview(id: string, dto: UpdateReviewDto) {
    await this.requireReview(id)
    const review = await this.prisma.review.update({ where: { id }, data: dto })
    if (review.featured) await this.demoteOtherFeatured(review.id)
    await this.retranslate('Review', review, TRANSLATABLE.Review)
    return review
  }

  async deleteReview(id: string) {
    await this.requireReview(id)
    await this.prisma.review.delete({ where: { id } })
    await this.translations.forget('Review', id)
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

  /**
   * Fires the translations for a record that was just saved.
   *
   * Not awaited by the caller's response on purpose: translating four
   * languages takes seconds, and the host should not watch a spinner for text
   * they have already written. Failures are logged inside the service.
   */
  private retranslate(
    entity: string,
    record: { id: string } & Record<string, unknown>,
    fields: readonly string[],
  ): void {
    void this.translations.syncRecord(entity, record, fields)
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
