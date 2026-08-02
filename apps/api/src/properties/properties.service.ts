import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import {
  checkStayLength,
  computeQuote,
  nightsOf,
  rateForNight,
  type QuoteBreakdown,
  type StayLengthProblem,
} from '@areia-bela/shared'
import type { ExtraPricingType, SeasonType } from '@prisma/client'
import type { BlockedDate } from '@areia-bela/types'
import { PrismaService } from '../prisma/prisma.service'
import { QuoteRequestDto } from './dto/quote-request.dto'
import { UpdatePropertyDto } from './dto/update-property.dto'
import { CreateExtraDto, UpdateExtraDto } from './dto/extra.dto'
import { CreateBlockedDateDto, UpdateBlockedDateDto } from './dto/blocked-date.dto'
import { CreatePriceRuleDto, UpdatePriceRuleDto } from './dto/price-rule.dto'

const iso = (date: Date) => date.toISOString().slice(0, 10)

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuote(
    slug: string,
    dto: QuoteRequestDto,
  ): Promise<QuoteBreakdown & { stayLength: StayLengthProblem | null }> {
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

    const quote = computeQuote({
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      // Infants never count towards capacity or price.
      guests: dto.guests ? dto.guests.adults + dto.guests.children : undefined,
      selectedExtraIds: dto.extraIds,
      extraUnits: dto.extraUnits,
      pricing: this.pricingInputFor(property),
    })

    // Priced, but flagged. A 400 here would blank the price card on every
    // date change, and the guest would never learn what the limit is.
    //
    // The minimum comes from the quote, not from the property: these dates may
    // fall in a season that asks for more nights than the house does.
    return {
      ...quote,
      stayLength: checkStayLength(quote.nights, {
        minNights: quote.minNights,
        maxNights: property.maxNights,
      }),
    }
  }

  /**
   * Turns the stored property into what computeQuote needs.
   *
   * One place, used by both the quote endpoint and booking creation, so a
   * guest can never be quoted one figure and charged another.
   */
  /**
   * The seasons the host has defined, newest range first.
   *
   * Read-only until now: seasons could only exist by seeding the database, so
   * a peak week was something a developer added. `minNights` made that worse —
   * a rule nobody can write is a rule that never applies.
   */
  async listPriceRules(slug: string) {
    const property = await this.prisma.property.findUnique({
      where: { slug },
      include: { priceRules: { orderBy: [{ type: 'asc' }, { startDate: 'asc' }] } },
    })
    if (!property) throw new NotFoundException(`Property "${slug}" not found`)

    return property.priceRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      type: rule.type,
      startDate: rule.startDate ? iso(rule.startDate) : null,
      endDate: rule.endDate ? iso(rule.endDate) : null,
      nightlyRate: Number(rule.nightlyRate),
      minNights: rule.minNights,
      active: rule.active,
    }))
  }

  async createPriceRule(slug: string, dto: CreatePriceRuleDto) {
    const property = await this.prisma.property.findUnique({
      where: { slug },
      include: { priceRules: true },
    })
    if (!property) throw new NotFoundException(`Property "${slug}" not found`)

    this.assertShape(dto.type, dto.startDate, dto.endDate)

    if (dto.type === 'HIGH') {
      this.assertNoOverlap(property.priceRules, dto.startDate!, dto.endDate!)
    } else if (property.priceRules.some((rule) => rule.type === dto.type)) {
      // LOW is the base rate and WEEKEND is the recurring one. A second of
      // either would make `ruleForNight` pick whichever the query returned
      // first, so the same night could be priced two ways on two requests.
      throw new ConflictException(`There is already a ${dto.type} rule`)
    }

    await this.prisma.priceRule.create({
      data: {
        propertyId: property.id,
        name: dto.name,
        type: dto.type,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        nightlyRate: dto.nightlyRate,
        minNights: dto.minNights,
        active: dto.active ?? true,
      },
    })

    return this.listPriceRules(slug)
  }

  async updatePriceRule(id: string, dto: UpdatePriceRuleDto) {
    const rule = await this.prisma.priceRule.findUnique({
      where: { id },
      include: { property: { select: { slug: true, priceRules: true } } },
    })
    if (!rule) throw new NotFoundException('Price rule not found')

    const startDate = dto.startDate ?? (rule.startDate ? iso(rule.startDate) : undefined)
    const endDate = dto.endDate ?? (rule.endDate ? iso(rule.endDate) : undefined)
    this.assertShape(rule.type, startDate, endDate)

    if (rule.type === 'HIGH') {
      this.assertNoOverlap(
        rule.property.priceRules.filter((other) => other.id !== id),
        startDate!,
        endDate!,
      )
    }

    await this.prisma.priceRule.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        nightlyRate: dto.nightlyRate,
        // Explicit null clears the season's own floor; undefined leaves it.
        minNights: dto.minNights === undefined ? undefined : dto.minNights,
        active: dto.active,
      },
    })

    return this.listPriceRules(rule.property.slug)
  }

  async deletePriceRule(id: string) {
    const rule = await this.prisma.priceRule.findUnique({
      where: { id },
      include: { property: { select: { slug: true } } },
    })
    if (!rule) throw new NotFoundException('Price rule not found')

    if (rule.type === 'LOW') {
      // Every night that no season covers is priced by LOW. Without it a stay
      // would quote at zero, which is worse than refusing to delete it.
      throw new ConflictException('The base rate cannot be deleted')
    }

    await this.prisma.priceRule.delete({ where: { id } })
    return this.listPriceRules(rule.property.slug)
  }

  /** HIGH is a dated range; LOW and WEEKEND are not. */
  private assertShape(type: SeasonType, startDate?: string, endDate?: string) {
    if (type === 'HIGH') {
      if (!startDate || !endDate) {
        throw new BadRequestException('A high season needs a start and an end date')
      }
      if (startDate > endDate) {
        throw new BadRequestException('The season ends before it starts')
      }
      return
    }
    if (startDate || endDate) {
      throw new BadRequestException(`A ${type} rule has no dates: it is the fallback rate`)
    }
  }

  /**
   * Two dated seasons must not cover the same night.
   *
   * `ruleForNight` takes the first HIGH rule that matches, so overlapping
   * ranges would price a night by whichever row the database happened to
   * return first — the same stay quoted differently on two requests.
   */
  private assertNoOverlap(
    rules: Array<{ type: SeasonType; startDate: Date | null; endDate: Date | null; name: string }>,
    startDate: string,
    endDate: string,
  ) {
    const clash = rules.find(
      (rule) =>
        rule.type === 'HIGH' &&
        rule.startDate &&
        rule.endDate &&
        startDate <= iso(rule.endDate) &&
        endDate >= iso(rule.startDate),
    )
    if (clash) {
      throw new ConflictException(`These dates overlap "${clash.name}"`)
    }
  }

  private pricingInputFor(property: {
    cleaningFee: unknown
    serviceFeePercent: unknown
    taxesPercent: unknown
    additionalGuestFeePerNight: unknown
    weeklyDiscountPercent: unknown
    weeklyDiscountNights: number
    minNights: number
    maxNights: number
    maxGuests: number
    priceRules: Array<{
      type: SeasonType
      nightlyRate: unknown
      startDate: Date | null
      endDate: Date | null
      minNights: number | null
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
        minNights: rule.minNights,
      })),
      cleaningFee: Number(property.cleaningFee),
      serviceFeePercent: Number(property.serviceFeePercent),
      taxesPercent: Number(property.taxesPercent),
      additionalGuestFeePerNight: Number(property.additionalGuestFeePerNight),
      weeklyDiscountPercent: Number(property.weeklyDiscountPercent),
      weeklyDiscountNights: property.weeklyDiscountNights,
      minNights: property.minNights,
      maxNights: property.maxNights,
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

    // Checked against what is being saved, falling back to what is stored: a
    // PATCH may carry only one of the two, and a minimum above the maximum
    // makes the house unbookable in a way nothing else would report.
    const min = dto.minNights ?? property.minNights
    const max = dto.maxNights ?? property.maxNights
    if (min > max) {
      throw new BadRequestException('minNights cannot be greater than maxNights')
    }

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

  /** BlockedDate ranges, so both calendars can grey them out. */
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

  /**
   * Takes dates off the market for a reason that is not a booking: maintenance,
   * the host's own stay, a week held for family.
   *
   * Refuses to cover a live booking. Nothing in the database stops that — the
   * exclusion constraint guards bookings against each other, not against
   * BlockedDate — so a guest with a paid stay would simply vanish from the
   * calendar while their booking still existed.
   */
  async blockDates(slug: string, dto: CreateBlockedDateDto): Promise<BlockedDate> {
    const property = await this.prisma.property.findUnique({ where: { slug } })
    if (!property) throw new NotFoundException(`Property "${slug}" not found`)

    const start = new Date(dto.startDate)
    const end = new Date(dto.endDate)
    if (end < start) {
      throw new BadRequestException('endDate cannot be before startDate')
    }

    const clash = await this.prisma.booking.findFirst({
      where: {
        propertyId: property.id,
        status: { not: 'CANCELLED' },
        NOT: { status: 'PENDING', expiresAt: { lt: new Date() } },
        // A booking ends the morning of checkOut, so a block starting that day
        // does not overlap it.
        checkIn: { lte: end },
        checkOut: { gt: start },
      },
      select: { reference: true },
    })
    if (clash) {
      throw new ConflictException(`Those dates hold booking ${clash.reference}`)
    }

    const created = await this.prisma.blockedDate.create({
      data: {
        propertyId: property.id,
        startDate: start,
        endDate: end,
        reason: dto.reason,
      },
    })

    return {
      id: created.id,
      propertyId: created.propertyId,
      startDate: created.startDate.toISOString(),
      endDate: created.endDate.toISOString(),
      reason: created.reason ?? undefined,
    }
  }

  /**
   * Corrects why a block exists, without touching when it exists.
   *
   * Fixing a typo used to mean freeing the nights and blocking them again —
   * which, for the seconds in between, put a week the host had closed back on
   * sale. The dates are not editable here on purpose: moving a block is a
   * different block and has to be checked against bookings all over again.
   */
  async updateBlockedDate(id: string, dto: UpdateBlockedDateDto): Promise<BlockedDate> {
    const existing = await this.prisma.blockedDate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Blocked range not found')

    const updated = await this.prisma.blockedDate.update({
      where: { id },
      // An empty string clears the reason rather than storing a blank one.
      data: { reason: dto.reason?.trim() || null },
    })

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      reason: updated.reason ?? undefined,
    }
  }

  /** Puts the nights back on sale. */
  async unblockDates(id: string): Promise<void> {
    const deleted = await this.prisma.blockedDate.deleteMany({ where: { id } })
    if (!deleted.count) throw new NotFoundException('Blocked range not found')
  }
}
