import { Controller, HttpCode, Param, Post } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { CalendarSyncService } from './calendar-sync.service'

@Controller('calendar-sync')
export class CalendarSyncController {
  constructor(private readonly calendarSync: CalendarSyncService) {}

  /**
   * Runs the import now, without waiting for the quarter hour.
   *
   * The panel needs this for the moment the host pastes the URL for the first
   * time, or changes it: telling her to wait fifteen minutes to find out whether
   * she pasted the right thing is how a feature gets abandoned.
   *
   * A VIEWER can look at the calendar but not go and change what is on it.
   */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post(':slug/airbnb')
  @HttpCode(200)
  async sync(@Param('slug') slug: string) {
    // Never a bare `null`: Nest serialises that as an empty body, and a caller
    // parsing JSON gets "Unexpected end of JSON input" — which says nothing
    // about the only thing that happened, which is that no calendar is set.
    const result = await this.calendarSync.importAirbnb(slug)
    return result ?? { configured: false }
  }
}
