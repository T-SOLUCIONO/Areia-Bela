import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { computeQuote, type QuoteBreakdown } from '@areia-bela/shared'
import type { BlockedDate } from '@areia-bela/types'
import { PrismaService } from '../prisma/prisma.service'
import { QuoteRequestDto } from './dto/quote-request.dto'
import { UpdatePropertyDto } from './dto/update-property.dto'
import { CreateExtraDto, UpdateExtraDto } from './dto/extra.dto'

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

  /** The single property row, with its extras. Public: the guest site reads it. */
  async getProperty(slug: string) {
    const property = await this.prisma.property.findUnique({
      where: { slug },
      include: { extras: { orderBy: { key: 'asc' } } },
    })
    if (!property) throw new NotFoundException(`Property "${slug}" not found`)
    return property
  }

  async updateProperty(slug: string, dto: UpdatePropertyDto) {
    const property = await this.prisma.property.findUnique({ where: { slug } })
    if (!property) throw new NotFoundException(`Property "${slug}" not found`)

    return this.prisma.property.update({ where: { slug }, data: dto })
  }

  listExtras(slug: string) {
    return this.prisma.extra.findMany({
      where: { property: { slug } },
      orderBy: { key: 'asc' },
    })
  }

  async createExtra(slug: string, dto: CreateExtraDto) {
    const property = await this.prisma.property.findUnique({ where: { slug } })
    if (!property) throw new NotFoundException(`Property "${slug}" not found`)

    const clash = await this.prisma.extra.findUnique({
      where: { propertyId_key: { propertyId: property.id, key: dto.key } },
    })
    if (clash) throw new ConflictException(`An extra with key "${dto.key}" already exists`)

    return this.prisma.extra.create({ data: { ...dto, propertyId: property.id } })
  }

  async updateExtra(id: string, dto: UpdateExtraDto) {
    await this.requireExtra(id)
    return this.prisma.extra.update({ where: { id }, data: dto })
  }

  /**
   * Deactivates rather than deletes: past bookings reference their extras
   * through BookingExtra, and removing the row would rewrite history.
   */
  async deactivateExtra(id: string) {
    await this.requireExtra(id)
    return this.prisma.extra.update({ where: { id }, data: { active: false } })
  }

  private async requireExtra(id: string) {
    const extra = await this.prisma.extra.findUnique({ where: { id } })
    if (!extra) throw new NotFoundException('Extra not found')
    return extra
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
