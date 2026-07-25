import { Body, Controller, Param, Post } from '@nestjs/common'
import { PropertiesService } from './properties.service'
import { QuoteRequestDto } from './dto/quote-request.dto'

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post(':slug/quote')
  getQuote(@Param('slug') slug: string, @Body() dto: QuoteRequestDto) {
    return this.propertiesService.getQuote(slug, dto)
  }
}
