import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Throttle } from '@nestjs/throttler'
import type { Response } from 'express'
import { GUEST_SESSION_COOKIE, GUEST_SESSION_TTL_SECONDS } from '@areia-bela/shared'
import { Public } from '../auth/decorators/public.decorator'
import { GuestAuthService } from './guest-auth.service'
import { GuestService } from './guest.service'
import { BookingPdfService } from './booking-pdf.service'
import { GuestGuard } from './guest.guard'
import { CurrentGuest, type CurrentGuestPayload } from './current-guest.decorator'
import { RedeemLinkDto, RequestLinkDto, UpdateMyDetailsDto } from './dto/guest-auth.dto'

/**
 * The guest area: sign in with an emailed link, see your stays, fix your
 * details. No passwords anywhere.
 *
 * Every route is `@Public()` as far as the staff guard is concerned — a guest
 * is a Customer, not a User — and the ones that need a session carry
 * `GuestGuard` instead.
 */
@Controller('guest')
export class GuestController {
  constructor(
    private readonly guestAuth: GuestAuthService,
    private readonly guests: GuestService,
    private readonly pdfs: BookingPdfService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Asks for a sign-in link.
   *
   * Always 204, whether or not that address has ever booked. Answering
   * differently would turn this into a way to ask the house whether a given
   * person stayed here.
   *
   * Rate limited hard: it sends email to an address the caller chooses, which
   * is a spam cannon if left open.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @HttpCode(204)
  @Post('login')
  async requestLink(@Body() dto: RequestLinkDto) {
    await this.guestAuth.requestLink(dto.email, dto.locale ?? 'es')
  }

  /** Spends the link and opens the session. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('login/redeem')
  async redeem(@Body() dto: RedeemLinkDto, @Res({ passthrough: true }) res: Response) {
    const identity = await this.guestAuth.redeem(dto.token)

    res.cookie(GUEST_SESSION_COOKIE, this.guestAuth.signSession(identity), {
      // Same posture as the staff cookies: unreadable from JS, and only sent
      // over HTTPS once deployed.
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: GUEST_SESSION_TTL_SECONDS * 1000,
    })

    return { name: identity.name, email: identity.email }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(GUEST_SESSION_COOKIE, { path: '/' })
  }

  @Public()
  @UseGuards(GuestGuard)
  @Get('me')
  me(@CurrentGuest() guest: CurrentGuestPayload) {
    return this.guests.myDetails(guest.customerId)
  }

  @Public()
  @UseGuards(GuestGuard)
  @Patch('me')
  updateMe(@CurrentGuest() guest: CurrentGuestPayload, @Body() dto: UpdateMyDetailsDto) {
    return this.guests.updateMyDetails(guest.customerId, dto)
  }

  @Public()
  @UseGuards(GuestGuard)
  @Get('bookings')
  myBookings(@CurrentGuest() guest: CurrentGuestPayload) {
    return this.guests.myBookings(guest.customerId)
  }

  /**
   * The booking as a PDF to keep or print.
   *
   * Behind the session like everything else here: a reference in a URL is not
   * a credential, and this document carries the guest's name and email.
   */
  @Public()
  @UseGuards(GuestGuard)
  @Get('bookings/:reference/pdf')
  async pdf(
    @CurrentGuest() guest: CurrentGuestPayload,
    @Param('reference') reference: string,
    @Query('locale') locale: string | undefined,
    @Res() res: Response,
  ) {
    const [booking, details] = await Promise.all([
      this.guests.myBooking(guest.customerId, reference),
      this.guests.myDetails(guest.customerId),
    ])

    const pdf = await this.pdfs.render(
      booking,
      `${details.firstName} ${details.lastName}`,
      details.email,
      locale === 'en' ? 'en' : 'es',
    )

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="areia-bela-${reference}.pdf"`)
    res.send(pdf)
  }
}
