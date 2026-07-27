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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CMSPageSlug, UserRole } from '@prisma/client'
import { CmsService } from './cms.service'
import { StorageService } from './storage.service'
import {
  CreateFAQDto,
  ReorderDto,
  UpdateCMSPageDto,
  UpdateFAQDto,
  UpdateGalleryImageDto,
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
  ) {}

  // --- Public reads --------------------------------------------------------

  @Public()
  @Get('pages')
  listPublicPages() {
    return this.cms.listPages(true)
  }

  @Public()
  @Get('pages/:slug')
  getPage(@Param('slug', new ParseEnumPipe(CMSPageSlug)) slug: CMSPageSlug) {
    return this.cms.getPage(slug)
  }

  @Public()
  @Get('faqs')
  listPublicFaqs() {
    return this.cms.listFaqs(true)
  }

  @Public()
  @Get('gallery')
  listPublicImages() {
    return this.cms.listImages(true)
  }

  @Public()
  @Get('settings')
  getSettings() {
    return this.cms.getSettings()
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
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('altEs') altEs?: string,
    @Body('altEn') altEn?: string,
  ) {
    this.storage.assertValidImage(file)
    const url = await this.storage.upload(file)
    // Alt text is required for accessibility but shouldn't block the upload;
    // it defaults to something editable rather than an empty string.
    return this.cms.addImage({
      url,
      altEs: altEs?.trim() || 'Areia Bela',
      altEn: altEn?.trim() || 'Areia Bela',
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
}
