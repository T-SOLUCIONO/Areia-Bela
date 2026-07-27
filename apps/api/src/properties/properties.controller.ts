import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { PropertiesService } from './properties.service'
import { QuoteRequestDto } from './dto/quote-request.dto'
import { Public } from '../auth/decorators/public.decorator'

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

  @Public()
  @Get(':slug/blocked-dates')
  getBlockedDates(@Param('slug') slug: string) {
    return this.propertiesService.getBlockedDates(slug)
  }
}
