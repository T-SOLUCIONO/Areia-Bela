import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { PropertiesService } from './properties.service'
import { QuoteRequestDto } from './dto/quote-request.dto'
import { UserRole } from '@prisma/client'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UpdatePropertyDto } from './dto/update-property.dto'
import { CreateExtraDto, UpdateExtraDto } from './dto/extra.dto'
import { CreateBlockedDateDto } from './dto/blocked-date.dto'
import { CreatePriceRuleDto, UpdatePriceRuleDto } from './dto/price-rule.dto'

// The guest-facing site calls these without signing in, so they opt out of the
// globally registered JwtAuthGuard. Everything else defaults to protected.
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Public()
  @Post(':slug/quote')
  getQuote(@Param('slug') slug: string, @Body() dto: QuoteRequestDto) {
    return this.propertiesService.getQuote(slug, dto)
  }

  /** Nightly rates and availability for the public calendar. */
  @Public()
  @Get(':slug/rates')
  getRates(@Param('slug') slug: string, @Query('from') from: string, @Query('to') to: string) {
    return this.propertiesService.getRates(slug, from, to)
  }

  @Public()
  @Get(':slug/blocked-dates')
  getBlockedDates(@Param('slug') slug: string) {
    return this.propertiesService.getBlockedDates(slug)
  }

  /**
   * Blocks dates by hand. Not a booking: maintenance, the host's own stay.
   *
   * A VIEWER can see the calendar but not close the house.
   */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post(':slug/blocked-dates')
  blockDates(@Param('slug') slug: string, @Body() dto: CreateBlockedDateDto) {
    return this.propertiesService.blockDates(slug, dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Delete('blocked-dates/:id')
  @HttpCode(204)
  async unblockDates(@Param('id') id: string) {
    await this.propertiesService.unblockDates(id)
  }

  @Public()
  @Get(':slug')
  getProperty(@Param('slug') slug: string) {
    return this.propertiesService.getProperty(slug)
  }

  // Editing the property and its extras is the settings screen; viewers can
  // read the panel but not change what guests are charged.
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch(':slug')
  updateProperty(@Param('slug') slug: string, @Body() dto: UpdatePropertyDto) {
    return this.propertiesService.updateProperty(slug, dto)
  }

  @Public()
  @Get(':slug/extras')
  listExtras(@Param('slug') slug: string) {
    return this.propertiesService.listExtras(slug)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post(':slug/extras')
  createExtra(@Param('slug') slug: string, @Body() dto: CreateExtraDto) {
    return this.propertiesService.createExtra(slug, dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('extras/:id')
  updateExtra(@Param('id') id: string, @Body() dto: UpdateExtraDto) {
    return this.propertiesService.updateExtra(id, dto)
  }

  /** The seasons, for the panel. Public reads go through the quote instead. */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @Get(':slug/price-rules')
  listPriceRules(@Param('slug') slug: string) {
    return this.propertiesService.listPriceRules(slug)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post(':slug/price-rules')
  createPriceRule(@Param('slug') slug: string, @Body() dto: CreatePriceRuleDto) {
    return this.propertiesService.createPriceRule(slug, dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch('price-rules/:id')
  updatePriceRule(@Param('id') id: string, @Body() dto: UpdatePriceRuleDto) {
    return this.propertiesService.updatePriceRule(id, dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Delete('price-rules/:id')
  deletePriceRule(@Param('id') id: string) {
    return this.propertiesService.deletePriceRule(id)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Delete('extras/:id')
  deactivateExtra(@Param('id') id: string) {
    return this.propertiesService.deactivateExtra(id)
  }
}
