import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { computeQuote, nightsOf, rateForNight, type QuoteBreakdown } from '@areia-bela/shared'
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
   * What each night costs, and whether it can be booked, across a range.
   *
   * Feeds the price under each day in the calendar. The rate has to come from
   * here rather than being worked out in the browser for the same reason the
   * total does: it is the figure the guest will be charged.
   */
  async getRates(slug: string, from: string, to: string) {
    const property = await this.prisma.property.findUnique({
      where: { slug },
      include: { priceRules: { where: { active: true } } },
    })
    if (!property) throw new NotFoundException(`Property "${slug}" not found`)

    const rules = property.priceRules.map((rule) => ({
      type: rule.type,
      nightlyRate: Number(rule.nightlyRate),
      startDate: rule.startDate?.toISOString() ?? null,
      endDate: rule.endDate?.toISOString() ?? null,
    }))

    const taken = await this.takenNights(property.id, from, to)

    return nightsOf(from, to).map((date) => ({
      date,
      ...rateForNight(date, rules),
      available: !taken.has(date),
    }))
  }

  /**
   * Every night in the range that is already spoken for, whether by a booking
   * or by a date the host blocked.
   *
   * Cancelled bookings free their nights back up. A pending one does not,
   * because someone is paying for it right now — unless its hold expired, in
   * which case nobody is.
   */
  private async takenNights(propertyId: string, from: string, to: string): Promise<Set<string>> {
    const [bookings, blocked] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          propertyId,
          status: { not: 'CANCELLED' },
          // A hold whose payment window ran out is not holding anything. It is
          // still PENDING in the table until the next hold sweeps it — see
          // BookingsService.createHold — so it has to be filtered here or the
          // calendar would show an abandoned checkout as a booked week.
          NOT: { status: 'PENDING', expiresAt: { lt: new Date() } },
          checkIn: { lt: new Date(to) },
          checkOut: { gt: new Date(from) },
        },
        select: { checkIn: true, checkOut: true },
      }),
      this.prisma.blockedDate.findMany({
        where: {
          propertyId,
          startDate: { lte: new Date(to) },
          endDate: { gte: new Date(from) },
        },
        select: { startDate: true, endDate: true },
      }),
    ])

    const nights = new Set<string>()
    const iso = (date: Date) => date.toISOString().slice(0, 10)

    for (const booking of bookings) {
      // Check-out day is not a night: the next guest can arrive that morning.
      for (const night of nightsOf(iso(booking.checkIn), iso(booking.checkOut))) nights.add(night)
    }
    for (const range of blocked) {
      // A blocked range is inclusive of its end — the host meant that day too.
      for (const night of nightsOf(iso(range.startDate), iso(range.endDate))) nights.add(night)
      nights.add(iso(range.endDate))
    }

    return nights
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
