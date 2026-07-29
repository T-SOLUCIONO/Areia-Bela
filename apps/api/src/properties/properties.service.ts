import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { computeQuote, type QuoteBreakdown } from '@areia-bela/shared'
import type { ExtraPricingType, SeasonType } from '@prisma/client'
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

    if (!property.priceRules.some((rule) => rule.type === 'LOW')) {
      throw new InternalServerErrorException(`Property "${slug}" has no base price rule configured`)
    }

    return computeQuote({
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      // Infants never count towards capacity or price.
      guests: dto.guests ? dto.guests.adults + dto.guests.children : undefined,
      selectedExtraIds: dto.extraIds,
      extraUnits: dto.extraUnits,
      pricing: this.pricingInputFor(property),
    })
  }

  /**
   * Turns the stored property into what computeQuote needs.
   *
   * One place, used by both the quote endpoint and booking creation, so a
   * guest can never be quoted one figure and charged another.
   */
  private pricingInputFor(property: {
    cleaningFee: unknown
    serviceFeePercent: unknown
    taxesPercent: unknown
    additionalGuestFeePerNight: unknown
    weeklyDiscountPercent: unknown
    weeklyDiscountNights: number
    maxGuests: number
    priceRules: Array<{
      type: SeasonType
      nightlyRate: unknown
      startDate: Date | null
      endDate: Date | null
    }>
    extras: Array<{
      key: string
      name: string
      price: unknown
      pricingType: ExtraPricingType
      seasonStartMonthDay: string | null
      seasonEndMonthDay: string | null
      active: boolean
    }>
  }) {
    return {
      priceRules: property.priceRules.map((rule) => ({
        type: rule.type,
        nightlyRate: Number(rule.nightlyRate),
        startDate: rule.startDate?.toISOString() ?? null,
        endDate: rule.endDate?.toISOString() ?? null,
      })),
      cleaningFee: Number(property.cleaningFee),
      serviceFeePercent: Number(property.serviceFeePercent),
      taxesPercent: Number(property.taxesPercent),
      additionalGuestFeePerNight: Number(property.additionalGuestFeePerNight),
      weeklyDiscountPercent: Number(property.weeklyDiscountPercent),
      weeklyDiscountNights: property.weeklyDiscountNights,
      // The listing's headline capacity is what the nightly rate buys; anyone
      // above it is a surcharge, and nobody above maxGuests can book at all.
      includedGuests: property.maxGuests,
      maxGuests: property.maxGuests,
      extras: property.extras
        .filter((extra) => extra.active)
        .map((extra) => ({
          id: extra.key,
          label: extra.name,
          price: Number(extra.price),
          pricingType: extra.pricingType,
          seasonStartMonthDay: extra.seasonStartMonthDay,
          seasonEndMonthDay: extra.seasonEndMonthDay,
        })),
    }
  }

  /**
   * The single property row, with its extras and price rules. Public: the
   * guest site reads it, and every figure here is already quoted to guests.
   */
  async getProperty(slug: string) {
    const property = await this.prisma.property.findUnique({
      where: { slug },
      include: {
        extras: { orderBy: { key: 'asc' } },
        priceRules: { orderBy: { type: 'asc' } },
      },
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
