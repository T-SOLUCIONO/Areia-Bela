import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { MailModule } from '../mail/mail.module'
import { GuestAuthService } from './guest-auth.service'
import { GuestController } from './guest.controller'
import { GuestService } from './guest.service'
import { GuestGuard } from './guest.guard'
import { BookingPdfService } from './booking-pdf.service'

@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [GuestController],
  providers: [GuestAuthService, GuestService, GuestGuard, BookingPdfService],
  exports: [GuestAuthService, GuestService, BookingPdfService],
})
export class GuestModule {}
