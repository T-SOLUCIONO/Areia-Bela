import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { UserRole } from '@prisma/client'
import type { Request } from 'express'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { BookingsService } from './bookings.service'
import { StripeWebhookService } from './stripe-webhook.service'
import { CreateHoldDto } from './dto/create-hold.dto'
import { CancelBookingDto } from './dto/cancel-booking.dto'

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly webhook: StripeWebhookService,
  ) {}

  /**
   * Holds the dates so the guest can pay for them.
   *
   * Public, and rate limited because of it: each call writes a row that takes
   * a week off the calendar for half an hour, so an unlimited version is a way
   * to close the house for free.
   */
  @Public()
  @Throttle({ default: { limit: 8, ttl: 600_000 } })
  @Post(':slug/hold')
  hold(@Param('slug') slug: string, @Body() dto: CreateHoldDto) {
    return this.bookings.hold(slug, dto)
  }

  /**
   * Stripe telling us what happened to a payment.
   *
   * This is the only thing in the system that can turn a hold into a booking.
   * The success redirect cannot: it is a URL the guest's browser visits, and a
   * browser that can confirm its own booking is a browser that can book for
   * free.
   */
  @Public()
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  @HttpCode(200)
  @Post('stripe-webhook')
  async stripeWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature']
    if (!req.rawBody || typeof signature !== 'string') {
      throw new BadRequestException('Missing Stripe signature')
    }

    await this.webhook.handle(req.rawBody, signature)
    return { received: true }
  }

  /**
   * What the confirmation page shows after payment.
   *
   * Keyed by the Stripe session id, which reaches nobody but the guest who
   * paid — it arrives in their return URL. Not guessable, and not an id that
   * enumerates.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('session/:sessionId')
  findBySession(@Param('sessionId') sessionId: string) {
    return this.bookings.findBySession(sessionId)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @Get()
  list() {
    return this.bookings.list()
  }

  /** Cancelling frees the nights. A VIEWER can look but not do this. */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @HttpCode(204)
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Body() dto: CancelBookingDto) {
    await this.bookings.cancel(id, dto.reason)
  }
}
