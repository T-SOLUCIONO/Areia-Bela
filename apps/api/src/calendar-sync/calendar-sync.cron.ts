import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { CalendarSyncService } from './calendar-sync.service'

/** One house, one calendar. The slug is fixed for the same reason everything
 *  else in this system is: there is exactly one property. */
const PROPERTY_SLUG = 'areia-bela'

@Injectable()
export class CalendarSyncCron {
  private readonly logger = new Logger(CalendarSyncCron.name)

  constructor(private readonly calendarSync: CalendarSyncService) {}

  /**
   * Every quarter of an hour.
   *
   * Airbnb's own feed is generated on request, so this is as fresh as we choose
   * to make it — unlike the other direction, where Airbnb reads our calendar on
   * its own schedule and nothing here can hurry it.
   *
   * Fifteen minutes is the safety net, not the guarantee: what actually closes
   * the window is the check that runs against this same feed before a booking is
   * confirmed.
   */
  @Cron('0 */15 * * * *')
  async run(): Promise<void> {
    try {
      const result = await this.calendarSync.importAirbnb(PROPERTY_SLUG)
      // Null means no calendar is configured. Saying so every quarter of an
      // hour would bury the logs that matter under a setting nobody has filled.
      if (!result) return

      this.logger.log(
        `Airbnb calendar: ${result.blocks} block(s), ${result.nights} night(s)` +
          (result.collisions.length > 0 ? `, ${result.collisions.length} collision(s)` : ''),
      )
    } catch {
      // Already logged and written to the settings row by the service. Swallowed
      // here so an unreachable Airbnb does not take the process down with it.
    }
  }
}
