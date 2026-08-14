import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { CalendarSyncController } from './calendar-sync.controller'
import { CalendarSyncCron } from './calendar-sync.cron'
import { CalendarSyncService } from './calendar-sync.service'

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CalendarSyncController],
  providers: [CalendarSyncService, CalendarSyncCron],
  // The booking flow checks the same calendar before it confirms a stay.
  exports: [CalendarSyncService],
})
export class CalendarSyncModule {}
