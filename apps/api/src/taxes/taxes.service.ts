import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateFilingDto } from './dto/filing.dto'

export interface JurisdictionLine {
  id: string
  name: string
  authority: string
  percent: number
  /** Tax collected in the period, this jurisdiction's share. */
  collected: number
  /** Its share of what went back out. */
  refunded: number
  /** What is owed: collected minus refunded. */
  owed: number
  /** Set once the period has been declared to this authority. */
  filing: { id: string; amount: number; filedAt: string; reference: string | null } | null
}

export interface TaxableStay {
  reference: string
  guestName: string
  /** When the money was collected, which is what puts it in a period. */
  paidAt: string
  checkIn: string
  checkOut: string
  /** What the tax was charged on. */
  taxableBase: number
  taxCharged: number
  taxRefunded: number
  /**
   * What was actually charged, as a percentage of the base.
   *
   * Usually the house rate, and worth showing when it is not: a stay booked
   * before a rate change carries the old one for ever, because the bill is
   * frozen. Smoothing that away would declare a figure nobody collected.
   */
  effectivePercent: number
}

export interface TaxReport {
  from: string
  to: string
  jurisdictions: JurisdictionLine[]
  stays: TaxableStay[]
  totals: { collected: number; refunded: number; owed: number }
  /**
   * True when the jurisdictions do not add up to what guests were charged.
   * Silence here would mean quietly declaring less than was collected.
   */
  ratesMismatch: boolean
  /** The rate guests are actually charged, for comparison. */
  chargedPercent: number
}

const iso = (date: Date) => date.toISOString().slice(0, 10)
const round = (amount: number) => Math.round(amount * 100) / 100

/**
 * What the host owes, and to whom.
 *
 * A guest is charged one figure — 13 % in Pinellas County — but a return is
 * filed per authority: Florida DOR takes the state's 6 %, the Tax Collector
 * takes the county's 1 % and the 6 % tourist development tax, on their own
 * calendars. So the single stored `Booking.taxes` is split here by the rates
 * that were in force, rather than each booking storing three numbers it never
 * needed at the time.
 *
 * Two decisions worth naming, because both are the accountant's to confirm:
 *
 * - A stay belongs to the period it was **paid** in, not the one it happens in.
 *   Transient rental tax follows the rent when it is collected.
 * - A refund reduces the base **in proportion**: a booking's tax is a fixed
 *   share of its total, so returning a third of the money returns a third of
 *   the tax. Exact for a full refund, which is what every refund so far has
 *   been.
 */
@Injectable()
export class TaxesService {
  constructor(private readonly prisma: PrismaService) {}

  async report(range: { from: Date; to: Date }): Promise<TaxReport> {
    const [property, jurisdictions, bookings] = await Promise.all([
      this.prisma.property.findFirstOrThrow({ select: { taxesPercent: true } }),
      // In force at any point in the window: a rate that ended mid-period
      // still collected part of it.
      this.prisma.taxJurisdiction.findMany({
        where: {
          effectiveFrom: { lte: range.to },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: range.from } }],
        },
        orderBy: [{ effectiveFrom: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.booking.findMany({
        where: {
          // Paid, and not cancelled: a cancelled stay collected nothing to
          // declare. A refunded one did, and its refund is subtracted below.
          paidAt: { gte: range.from, lte: range.to },
          status: { not: 'CANCELLED' },
        },
        include: {
          customer: { select: { firstName: true, lastName: true } },
          refunds: { where: { status: { not: 'FAILED' } }, select: { amount: true } },
        },
        orderBy: { paidAt: 'asc' },
      }),
    ])

    const stays: TaxableStay[] = bookings.map((booking) => {
      const total = Number(booking.totalPrice)
      const taxCharged = Number(booking.taxes)
      const refunded = booking.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0)
      const base = round(
        Number(booking.nightsSubtotal) -
          Number(booking.weeklyDiscount) +
          Number(booking.additionalGuestFee),
      )

      return {
        reference: booking.reference,
        guestName: `${booking.customer.firstName} ${booking.customer.lastName}`,
        paidAt: booking.paidAt!.toISOString(),
        checkIn: iso(booking.checkIn),
        checkOut: iso(booking.checkOut),
        taxableBase: base,
        taxCharged: round(taxCharged),
        // Proportional. Guarded against a zero total so a comped stay cannot
        // divide by nothing.
        taxRefunded: total > 0 ? round((refunded / total) * taxCharged) : 0,
        effectivePercent: base > 0 ? round((taxCharged / base) * 100) : 0,
      }
    })

    const collectedTotal = round(stays.reduce((sum, stay) => sum + stay.taxCharged, 0))
    const refundedTotal = round(stays.reduce((sum, stay) => sum + stay.taxRefunded, 0))

    const chargedPercent = Number(property.taxesPercent)
    // Only the rates still in force are compared against what guests pay
    // today; a superseded rate is supposed to differ.
    const declaredPercent = jurisdictions
      .filter((one) => one.effectiveTo === null)
      .reduce((sum, one) => sum + Number(one.percent), 0)

    const filings = await this.prisma.taxFiling.findMany({
      where: { periodStart: range.from, periodEnd: range.to },
    })

    // Allocated stay by stay, using the rates in force the day the money came
    // in — not the rates in force today.
    //
    // A booking taken before a rate change keeps the old rate in its frozen
    // bill for ever. Splitting everything by today's percentages would hand
    // one authority a share of money that was collected under a different
    // arrangement, and the dated table exists precisely so that cannot happen.
    const collectedBy = new Map<string, number>()
    const refundedBy = new Map<string, number>()

    for (const stay of stays) {
      const paidOn = new Date(stay.paidAt)
      const inForce = jurisdictions.filter(
        (one) =>
          one.effectiveFrom <= paidOn && (one.effectiveTo === null || one.effectiveTo >= paidOn),
      )
      const total = inForce.reduce((sum, one) => sum + Number(one.percent), 0)
      if (total <= 0) continue

      for (const one of inForce) {
        const share = Number(one.percent) / total
        collectedBy.set(one.id, (collectedBy.get(one.id) ?? 0) + stay.taxCharged * share)
        refundedBy.set(one.id, (refundedBy.get(one.id) ?? 0) + stay.taxRefunded * share)
      }
    }

    const lines: JurisdictionLine[] = jurisdictions.map((one) => {
      const percent = Number(one.percent)
      const collected = round(collectedBy.get(one.id) ?? 0)
      const refunded = round(refundedBy.get(one.id) ?? 0)
      const filing = filings.find((row) => row.jurisdictionId === one.id)

      return {
        id: one.id,
        name: one.name,
        authority: one.authority,
        percent,
        collected,
        refunded,
        owed: round(collected - refunded),
        filing: filing
          ? {
              id: filing.id,
              amount: Number(filing.amount),
              filedAt: filing.filedAt.toISOString(),
              reference: filing.reference,
            }
          : null,
      }
    })

    return {
      from: iso(range.from),
      to: iso(range.to),
      jurisdictions: lines,
      stays,
      totals: {
        collected: collectedTotal,
        refunded: refundedTotal,
        owed: round(collectedTotal - refundedTotal),
      },
      // A tenth of a percent of tolerance: the rates are stored to two
      // decimals and this is a comparison, not arithmetic on money.
      ratesMismatch: jurisdictions.length > 0 && Math.abs(declaredPercent - chargedPercent) > 0.01,
      chargedPercent,
    }
  }

  /**
   * The report, as a file the accountant can open.
   *
   * One row per stay plus a summary block, because an accountant asked for a
   * figure will ask next which bookings make it up.
   */
  async csv(range: { from: Date; to: Date }): Promise<string> {
    const report = await this.report(range)

    const cell = (value: string | number) => {
      const text = String(value)
      // Quote anything that would otherwise break the column: a guest called
      // "Ortiz, Silvia" is one field, not two.
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const row = (values: Array<string | number>) => values.map(cell).join(',')

    const lines = [
      row(['Periodo', report.from, report.to]),
      '',
      row(['Jurisdicción', 'Autoridad', 'Porcentaje', 'Recaudado', 'Reembolsado', 'A declarar']),
      ...report.jurisdictions.map((one) =>
        row([one.name, one.authority, one.percent, one.collected, one.refunded, one.owed]),
      ),
      row([
        'TOTAL',
        '',
        report.chargedPercent,
        report.totals.collected,
        report.totals.refunded,
        report.totals.owed,
      ]),
      '',
      row([
        'Referencia',
        'Huésped',
        'Pagada',
        'Llegada',
        'Salida',
        'Base imponible',
        'Impuesto cobrado',
        '% efectivo',
        'Impuesto reembolsado',
      ]),
      ...report.stays.map((stay) =>
        row([
          stay.reference,
          stay.guestName,
          stay.paidAt.slice(0, 10),
          stay.checkIn,
          stay.checkOut,
          stay.taxableBase,
          stay.taxCharged,
          stay.effectivePercent,
          stay.taxRefunded,
        ]),
      ),
    ]

    return lines.join('\n')
  }

  /** Records that a period was declared and paid to one authority. */
  async recordFiling(dto: CreateFilingDto, userId?: string) {
    const jurisdiction = await this.prisma.taxJurisdiction.findUnique({
      where: { id: dto.jurisdictionId },
    })
    if (!jurisdiction) throw new NotFoundException('Jurisdiction not found')

    const periodStart = new Date(`${dto.periodStart}T00:00:00Z`)
    const periodEnd = new Date(`${dto.periodEnd}T00:00:00Z`)
    if (periodStart > periodEnd) {
      throw new BadRequestException('The period ends before it starts')
    }

    // Upsert rather than create: filing a period twice is a correction, not a
    // second payment, and two rows would double what the panel says was paid.
    const filing = await this.prisma.taxFiling.upsert({
      where: {
        jurisdictionId_periodStart_periodEnd: {
          jurisdictionId: dto.jurisdictionId,
          periodStart,
          periodEnd,
        },
      },
      update: {
        amount: dto.amount,
        filedAt: new Date(dto.filedAt),
        reference: dto.reference?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
      create: {
        jurisdictionId: dto.jurisdictionId,
        periodStart,
        periodEnd,
        amount: dto.amount,
        filedAt: new Date(dto.filedAt),
        reference: dto.reference?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdById: userId,
      },
    })

    return { id: filing.id, amount: Number(filing.amount), filedAt: filing.filedAt.toISOString() }
  }

  /** Undoes a filing that was recorded by mistake. */
  async removeFiling(id: string): Promise<void> {
    const filing = await this.prisma.taxFiling.findUnique({ where: { id } })
    if (!filing) throw new NotFoundException('Filing not found')
    await this.prisma.taxFiling.delete({ where: { id } })
  }

  listJurisdictions() {
    return this.prisma.taxJurisdiction
      .findMany({ orderBy: [{ effectiveFrom: 'asc' }, { name: 'asc' }] })
      .then((rows) =>
        rows.map((one) => ({
          id: one.id,
          name: one.name,
          authority: one.authority,
          percent: Number(one.percent),
          effectiveFrom: iso(one.effectiveFrom),
          effectiveTo: one.effectiveTo ? iso(one.effectiveTo) : null,
        })),
      )
  }
}
