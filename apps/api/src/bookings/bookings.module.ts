import { Module } from '@nestjs/common'
import { PropertiesModule } from '../properties/properties.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { BookingsController } from './bookings.controller'
import { BookingsService } from './bookings.service'
import { StripeWebhookService } from './stripe-webhook.service'

@Module({
  imports: [PropertiesModule, NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService, StripeWebhookService],
})
export class BookingsModule {}
