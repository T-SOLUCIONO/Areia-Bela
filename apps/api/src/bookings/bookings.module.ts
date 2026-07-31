import { Module } from '@nestjs/common'
import { PropertiesModule } from '../properties/properties.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { GuestModule } from '../guest/guest.module'
import { BookingsController } from './bookings.controller'
import { BookingsService } from './bookings.service'
import { StripeWebhookService } from './stripe-webhook.service'
import { PaymentsService } from './payments.service'

@Module({
  imports: [PropertiesModule, NotificationsModule, GuestModule],
  controllers: [BookingsController],
  providers: [BookingsService, StripeWebhookService, PaymentsService],
})
export class BookingsModule {}
