import { Body, Controller, Get, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { DEFAULT_LOCALE } from '@areia-bela/shared'
import { Public } from '../auth/decorators/public.decorator'
import { AssistantService } from './assistant.service'
import { AskDto } from './dto/ask.dto'

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  /**
   * Public, because a guest asking whether the pool is heated has no account.
   *
   * Rate limited harder than the contact form, and for a different reason: that
   * one protects the host's phone from being flooded, this one protects the
   * host's bill. Twenty questions in ten minutes is a thorough guest and a
   * useless amount of free language model.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @Post('ask')
  ask(@Body() dto: AskDto) {
    return this.assistant.ask(dto.question, dto.locale ?? DEFAULT_LOCALE, dto.history ?? [])
  }

  /**
   * Whether to offer the assistant at all.
   *
   * The widget asks first so that a site with no API key configured simply does
   * not show it, rather than showing a chat that apologises — an assistant that
   * cannot answer is worse than no assistant.
   */
  @Public()
  @Get('status')
  status() {
    return { available: this.assistant.available }
  }
}
