import { Module } from '@nestjs/common'
import { BookingsModule } from '../bookings/bookings.module'
import { PaymentsController } from './payments.controller'
import { PaymentsReportService } from './payments-report.service'

/**
 * Reporting on money, kept apart from the Stripe operations in BookingsModule:
 * one takes payments and sends refunds, this one only reads.
 */
@Module({
  imports: [BookingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsReportService],
})
export class PaymentsReportModule {}
