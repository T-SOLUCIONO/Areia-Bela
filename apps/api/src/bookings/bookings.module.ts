import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { PropertiesModule } from '../properties/properties.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { GuestModule } from '../guest/guest.module'
import { CalendarSyncModule } from '../calendar-sync/calendar-sync.module'
import { BookingsController } from './bookings.controller'
import { BookingsService } from './bookings.service'
import { StripeWebhookService } from './stripe-webhook.service'
import { PaymentsService } from './payments.service'
import { PaymentReconciliationService } from './payment-reconciliation.service'
import { RefundsService } from './refunds.service'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PropertiesModule,
    NotificationsModule,
    GuestModule,
    CalendarSyncModule,
  ],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    StripeWebhookService,
    PaymentsService,
    PaymentReconciliationService,
    RefundsService,
  ],
  exports: [RefundsService, PaymentsService],
})
export class BookingsModule {}
