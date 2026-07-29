import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { DEFAULT_LOCALE, isSupportedLocale } from '@areia-bela/shared'
import { FileInterceptor } from '@nestjs/platform-express'
import { CMSPageSlug, ContentSectionKey, UserRole } from '@prisma/client'
import { CmsService } from './cms.service'
import { StorageService } from './storage.service'
import { TranslationService } from './translation.service'
import {
  CreateContentItemDto,
  CreateFAQDto,
  CreateReviewDto,
  ReorderDto,
  UpdateCMSPageDto,
  UpdateContentItemDto,
  UpdateContentSectionDto,
  UpdateFAQDto,
  UpdateGalleryImageDto,
  UpdateReviewDto,
  UpdateSiteSettingsDto,
} from './dto/cms.dto'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'

/**
 * Read is public — the guest site renders this content — while every write
 * needs a signed-in editor. Viewers can look at the panel but not change copy,
 * so writes are limited to superadmin and manager.
 */
@Controller('cms')
export class CmsController {
  constructor(
    private readonly cms: CmsService,
    private readonly storage: StorageService,
    private readonly translation: TranslationService,
  ) {}

  // --- Public reads --------------------------------------------------------

  /**
   * The whole guest site in one language.
   *
   * `?locale=` picks it; anything unsupported falls back to the language the
   * content was written in. One call instead of six, because the page needs
   * all of it and each one would otherwise re-resolve translations.
   */
  @Public()
  @Get('site')
  getSite(@Query('locale') locale?: string) {
    return this.cms.getLocalizedContent(
      locale && isSupportedLocale(locale) ? locale : DEFAULT_LOCALE,
    )
  }

  @Public()
  @Get('pages/:slug')
  getPage(@Param('slug', new ParseEnumPipe(CMSPageSlug)) slug: CMSPageSlug) {
    return this.cms.getPage(slug)
  }

  // --- Editor reads (include unpublished drafts) ---------------------------
  // Any signed-in role, viewers included: seeing the panel is what the viewer
  // role is for, and unpublished copy is not a secret from the team. Only the
  // writes below are narrowed.

  @Get('admin/pages')
  listAllPages() {
    return this.cms.listPages()
  }

  @Get('admin/faqs')
  listAllFaqs() {
    return this.cms.listFaqs()
  }

  @Get('admin/gallery')
  listAllImages() {
    return this.cms.listImages()
  }

  @Get('admin/landing')
  listAllSections() {
    return this.cms.listSections()
  }

  @Get('admin/reviews')
  listAllReviews() {
    return this.cms.listReviews()
  }

  /**
   * Whether automatic translation is switched on. The admin shows a notice
   * when it isn't — otherwise the host writes in Spanish, the site stays in
   * Spanish for the other four languages, and nothing explains why.
   */
  @Get('admin/translation-status')
  translationStatus() {
    return {
      configured: this.translation.isConfigured,
      provider: this.translation.providerName,
    }
  }

  // --- Writes --------------------------------------------------------------

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('pages/:slug')
  updatePage(
    @Param('slug', new ParseEnumPipe(CMSPageSlug)) slug: CMSPageSlug,
    @Body() dto: UpdateCMSPageDto,
  ) {
    return this.cms.updatePage(slug, dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post('faqs')
  createFaq(@Body() dto: CreateFAQDto) {
    return this.cms.createFaq(dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('faqs/reorder')
  reorderFaqs(@Body() dto: ReorderDto) {
    return this.cms.reorderFaqs(dto.ids)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('faqs/:id')
  updateFaq(@Param('id') id: string, @Body() dto: UpdateFAQDto) {
    return this.cms.updateFaq(id, dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Delete('faqs/:id')
  @HttpCode(204)
  async deleteFaq(@Param('id') id: string) {
    await this.cms.deleteFaq(id)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post('gallery')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Body('alt') alt?: string) {
    this.storage.assertValidImage(file)
    const url = await this.storage.upload(file)
    // Alt text is required for accessibility but shouldn't block the upload;
    // it defaults to something editable rather than an empty string.
    return this.cms.addImage({
      url,
      alt: alt?.trim() || 'Areia Bela',
    })
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('gallery/reorder')
  reorderImages(@Body() dto: ReorderDto) {
    return this.cms.reorderImages(dto.ids)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('gallery/:id')
  updateImage(@Param('id') id: string, @Body() dto: UpdateGalleryImageDto) {
    return this.cms.updateImage(id, dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Delete('gallery/:id')
  @HttpCode(204)
  async deleteImage(@Param('id') id: string) {
    const image = await this.cms.deleteImage(id)
    // Row first, then the file: an orphaned blob is cheaper than a broken row.
    await this.storage.remove(image.url)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('settings')
  updateSettings(@Body() dto: UpdateSiteSettingsDto) {
    return this.cms.updateSettings(dto)
  }

  // --- Landing page --------------------------------------------------------

  // Reorder routes are declared before the ':id' ones: Nest matches in order,
  // and otherwise "reorder" would be read as an id.
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('landing/items/reorder')
  @HttpCode(204)
  async reorderItems(@Body() dto: ReorderDto) {
    await this.cms.reorderItems(dto.ids)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post('landing/items')
  createItem(@Body() dto: CreateContentItemDto) {
    return this.cms.createItem(dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('landing/items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateContentItemDto) {
    return this.cms.updateItem(id, dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Delete('landing/items/:id')
  @HttpCode(204)
  async deleteItem(@Param('id') id: string) {
    await this.cms.deleteItem(id)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('landing/:key')
  updateSection(
    @Param('key', new ParseEnumPipe(ContentSectionKey)) key: ContentSectionKey,
    @Body() dto: UpdateContentSectionDto,
  ) {
    return this.cms.updateSection(key, dto)
  }

  // --- Reviews -------------------------------------------------------------

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('reviews/reorder')
  @HttpCode(204)
  async reorderReviews(@Body() dto: ReorderDto) {
    await this.cms.reorderReviews(dto.ids)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post('reviews')
  createReview(@Body() dto: CreateReviewDto) {
    return this.cms.createReview(dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('reviews/:id')
  updateReview(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.cms.updateReview(id, dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Delete('reviews/:id')
  @HttpCode(204)
  async deleteReview(@Param('id') id: string) {
    await this.cms.deleteReview(id)
  }

  // --- Images for landing content ------------------------------------------

  /**
   * Uploads a card, host or reviewer photo and returns its URL. Separate from
   * the gallery: these belong to one field, not to the public photo grid, so
   * they must not show up in it.
   */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post('landing/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadContentImage(@UploadedFile() file: Express.Multer.File) {
    this.storage.assertValidImage(file)
    return { url: await this.storage.upload(file) }
  }
}
