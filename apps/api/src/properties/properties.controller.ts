import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { PropertiesService } from './properties.service'
import { QuoteRequestDto } from './dto/quote-request.dto'
import { UserRole } from '@prisma/client'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UpdatePropertyDto } from './dto/update-property.dto'
import { CreateExtraDto, UpdateExtraDto } from './dto/extra.dto'

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

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Delete('extras/:id')
  deactivateExtra(@Param('id') id: string) {
    return this.propertiesService.deactivateExtra(id)
  }
}
