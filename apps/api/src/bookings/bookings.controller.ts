import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { UserRole } from '@prisma/client'
import type { Request, Response } from 'express'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import type { AuthenticatedUser } from '../auth/auth.types'
import { BookingsService } from './bookings.service'
import { StripeWebhookService } from './stripe-webhook.service'
import { CreateHoldDto } from './dto/create-hold.dto'
import { CancelBookingDto } from './dto/cancel-booking.dto'
import { IssueRefundDto } from './dto/issue-refund.dto'
import { CreateManualBookingDto } from './dto/manual-booking.dto'
import { UpdateBookingDto } from './dto/update-booking.dto'
import { RefundsService } from './refunds.service'
import { BookingPdfService } from '../guest/booking-pdf.service'

@Controller('bookings')
export class BookingsController {
  /** The same allowlist CORS uses; a return URL must be one of these. */
  private readonly allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  constructor(
    private readonly bookings: BookingsService,
    private readonly webhook: StripeWebhookService,
    private readonly pdfs: BookingPdfService,
    private readonly refunds: RefundsService,
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
  hold(@Param('slug') slug: string, @Body() dto: CreateHoldDto, @Req() req: Request) {
    return this.bookings.hold(slug, dto, this.originFor(req))
  }

  /**
   * Where Stripe should send the guest back to.
   *
   * Stripe refuses a relative return URL, so it needs an absolute one. The
   * Origin header is set by the browser and cannot be forged from a page on
   * another site — and CORS already restricts who may call this at all.
   */
  private originFor(req: Request): string {
    const origin = req.headers.origin
    if (!origin || !this.allowedOrigins.includes(origin)) {
      throw new BadRequestException('Unknown origin')
    }
    return origin
  }

  /**
   * The guest turned back at the payment page.
   *
   * Public because the guest is not signed in, and safe to be: it needs the
   * booking's id, only touches a hold that is still unpaid, and the worst a
   * guessed id achieves is freeing dates the sweep would free within the half
   * hour anyway. Rate limited so it cannot be used to hunt for ids.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @HttpCode(204)
  @Post(':id/abandon')
  async abandon(@Param('id') id: string) {
    await this.bookings.abandonHold(id)
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

  /**
   * The same PDF the guest area serves, for someone who just paid and has not
   * signed in yet.
   *
   * Keyed by the Stripe session id on the same reasoning as the route above:
   * it reaches nobody but the guest who paid. Asking them to request an email
   * link before they can download the receipt for the payment they made thirty
   * seconds ago would be absurd.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @Get('session/:sessionId/pdf')
  async sessionPdf(
    @Param('sessionId') sessionId: string,
    @Query('locale') locale: string | undefined,
    @Res() res: Response,
  ) {
    const booking = await this.bookings.findBySession(sessionId)
    const pdf = await this.pdfs.render(
      booking,
      booking.guestName,
      booking.guestEmail,
      locale === 'en' ? 'en' : 'es',
    )

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="areia-bela-${booking.reference}.pdf"`,
    )
    res.send(pdf)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @Get()
  list() {
    return this.bookings.list()
  }

  /**
   * A stay taken over the phone.
   *
   * Not `@Public()` and not rate limited the way the guest hold is: this is
   * behind a session and the person using it is the one who owns the calendar.
   * The price is still the server's — the host types dates and a party, never
   * a total.
   */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post(':slug/manual')
  createManual(
    @Param('slug') slug: string,
    @Body() dto: CreateManualBookingDto,
    @Req() req: Request,
  ) {
    return this.bookings.createManual(slug, dto, this.originFor(req))
  }

  /** Cancelling frees the nights. A VIEWER can look but not do this. */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @HttpCode(204)
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Body() dto: CancelBookingDto) {
    await this.bookings.cancel(id, dto.reason)
  }

  /**
   * Moves a stay that already exists: dates, party or extras.
   *
   * Not `@Public()` and behind the same two roles as cancelling, for the same
   * reason: it rewrites what a guest owes. The total is recomputed on the
   * server — the DTO has no field for one, so there is nothing for a caller to
   * assert.
   *
   * Answers with the difference against the old total. It does **not** charge or
   * refund: see `BookingsService.update`.
   */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookings.update(id, dto)
  }

  /**
   * What the policy says this cancellation is worth, and what has already been
   * sent back. A VIEWER can see it; only the two roles above can act on it.
   */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @Get(':id/refund')
  refundSummary(@Param('id') id: string) {
    return this.refunds.summaryFor(id)
  }

  /**
   * Sends money back.
   *
   * Rate limited despite being behind auth: this is the one endpoint in the
   * panel that moves money out, and a loop that hits it is worse than a loop
   * that hits anything else here.
   */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/refund')
  issueRefund(
    @Param('id') id: string,
    @Body() dto: IssueRefundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.refunds.issue(id, { amount: dto.amount, note: dto.note, userId: user?.id })
  }
}
