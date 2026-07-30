import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { UserRole } from '@prisma/client'
import { Public } from '../auth/decorators/public.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { NotificationsService } from './notifications.service'
import { ContactMessageDto } from './dto/contact-message.dto'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /**
   * The contact form on the guest site.
   *
   * Public by necessity and rate limited because of it: three messages every
   * ten minutes from one address is plenty for a real guest and useless to
   * anyone trying to flood the host's phone.
   *
   * Always answers 204, even when nothing was configured to receive it. The
   * guest cannot fix the host's settings, and telling them their message went
   * nowhere would only worry them — the failure is logged where it can be
   * acted on.
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @Post('contact')
  @HttpCode(204)
  async contact(@Body() dto: ContactMessageDto) {
    await this.notifications.messageReceived(dto)
  }

  /** Lets the panel say which channels are actually working. */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Get('status')
  status() {
    return this.notifications.status()
  }
}
