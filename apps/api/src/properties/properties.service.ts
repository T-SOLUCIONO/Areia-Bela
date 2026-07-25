import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { computeQuote, type QuoteBreakdown } from '@areia-bela/shared'
import type { BlockedDate } from '@areia-bela/types'
import { PrismaService } from '../prisma/prisma.service'
import { QuoteRequestDto } from './dto/quote-request.dto'

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuote(slug: string, dto: QuoteRequestDto): Promise<QuoteBreakdown> {
    const property = await this.prisma.property.findUnique({
      where: { slug },
      include: {
        extras: { where: { active: true } },
        priceRules: { where: { active: true } },
      },
    })

    if (!property) {
      throw new NotFoundException(`Property "${slug}" not found`)
    }

    // Only the flat base rate is wired up today (matches the current UI,
    // which has no season-aware pricing yet). WEEKEND/HIGH PriceRule rows
    // can exist in the table but aren't applied until that logic lands
    // (Fase 6 calendar/booking work) — see docs/database.md.
    const baseRule = property.priceRules.find((rule) => rule.type === 'LOW')
    if (!baseRule) {
      throw new InternalServerErrorException(`Property "${slug}" has no base price rule configured`)
    }

    return computeQuote({
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      selectedExtraIds: dto.extraIds,
      pricing: {
        pricePerNight: Number(baseRule.nightlyRate),
        cleaningFee: Number(property.cleaningFee),
        serviceFeePercent: Number(property.serviceFeePercent),
        taxesPercent: Number(property.taxesPercent),
        extras: property.extras.map((extra) => ({
          id: extra.key,
          label: extra.nameEn,
          pricePerNight: Number(extra.price),
        })),
      },
    })
  }

  // Read-only for now: exposes BlockedDate ranges so the public calendar can
  // disable them. Booking creation, hold/pay/confirm, and conflict validation
  // beyond this exclusion land in Fase 6 — see docs/migration-plan.md.
  async getBlockedDates(slug: string): Promise<BlockedDate[]> {
    const property = await this.prisma.property.findUnique({ where: { slug } })

    if (!property) {
      throw new NotFoundException(`Property "${slug}" not found`)
    }

    const blockedDates = await this.prisma.blockedDate.findMany({
      where: { propertyId: property.id },
    })

    return blockedDates.map((blockedDate) => ({
      id: blockedDate.id,
      propertyId: blockedDate.propertyId,
      startDate: blockedDate.startDate.toISOString(),
      endDate: blockedDate.endDate.toISOString(),
      reason: blockedDate.reason ?? undefined,
    }))
  }
}
