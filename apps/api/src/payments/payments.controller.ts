import { Controller, Get, Query, BadRequestException } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { PaymentsReportService } from './payments-report.service'

@Controller('payments')
export class PaymentsController {
  constructor(private readonly report: PaymentsReportService) {}

  /**
   * The ledger for a window.
   *
   * A VIEWER can read it, like the bookings list: this is reporting, and the
   * two roles that can move money are already the only ones with a refund
   * button.
   */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @Get()
  get(@Query('from') from?: string, @Query('to') to?: string) {
    // Defaults to the current month, which is the question the host actually
    // asks: what came in this month.
    const now = new Date()
    const start = from
      ? new Date(`${from}T00:00:00Z`)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const end = to ? new Date(`${to}T23:59:59Z`) : now

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('from and to must be YYYY-MM-DD dates')
    }
    if (start > end) {
      throw new BadRequestException('from cannot be after to')
    }

    return this.report.report({ from: start, to: end })
  }
}
