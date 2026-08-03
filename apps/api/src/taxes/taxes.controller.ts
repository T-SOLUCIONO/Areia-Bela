import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import type { Response } from 'express'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import type { AuthenticatedUser } from '../auth/auth.types'
import { TaxesService } from './taxes.service'
import { CreateFilingDto } from './dto/filing.dto'

@Controller('taxes')
export class TaxesController {
  constructor(private readonly taxes: TaxesService) {}

  /** The rates in the system, so the panel can show what is being split. */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @Get('jurisdictions')
  jurisdictions() {
    return this.taxes.listJurisdictions()
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @Get()
  report(@Query('from') from?: string, @Query('to') to?: string) {
    return this.taxes.report(this.rangeFor(from, to))
  }

  /** The same figures as a file, for the accountant. */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @Get('export')
  async export(@Res() res: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const range = this.rangeFor(from, to)
    const csv = await this.taxes.csv(range)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="impuestos-${range.from.toISOString().slice(0, 10)}.csv"`,
    )
    // A BOM, so Excel opens it as UTF-8 rather than mangling "Jurisdicción".
    res.send(`﻿${csv}`)
  }

  /** Money leaving for an authority is not something a VIEWER records. */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post('filings')
  recordFiling(@Body() dto: CreateFilingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taxes.recordFiling(dto, user?.id)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @HttpCode(204)
  @Delete('filings/:id')
  async removeFiling(@Param('id') id: string) {
    await this.taxes.removeFiling(id)
  }

  /** Defaults to the current month, which is the question actually asked. */
  private rangeFor(from?: string, to?: string): { from: Date; to: Date } {
    const now = new Date()
    const start = from
      ? new Date(`${from}T00:00:00Z`)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const end = to
      ? new Date(`${to}T23:59:59Z`)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59))

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('from and to must be YYYY-MM-DD dates')
    }
    if (start > end) throw new BadRequestException('from cannot be after to')

    return { from: start, to: end }
  }
}
