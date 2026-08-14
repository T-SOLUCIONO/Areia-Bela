import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { parseIcal, type IcalBlock } from './ical'

/** The single settings row, pinned like everywhere else it is written. */
const SETTINGS_ID = 'settings'

/**
 * How long the importer waits for Airbnb.
 *
 * The live feed answers in about half a second. Ten is not a guess at how slow
 * it can be, it is how long a background job may sit on a socket before the
 * answer stops being worth having — the next run is fifteen minutes away.
 */
const FETCH_TIMEOUT_MS = 10_000

export interface SyncResult {
  /** Nights closed after the import, across all imported ranges. */
  nights: number
  /** Ranges written. */
  blocks: number
  /**
   * Direct bookings that overlap something Airbnb has taken.
   *
   * Reported, never resolved. Deciding which guest loses their stay is not a
   * thing a cron job gets to do at three in the morning.
   */
  collisions: Array<{ reference: string; checkIn: string; checkOut: string }>
}

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name)

  constructor(private readonly prisma: PrismaService) {}

  /** Downloads the calendar and hands back its blocks. Shared by the periodic
   *  import and the check that runs before a booking is confirmed. */
  async fetchBlocks(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<IcalBlock[]> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'AreiaBela/1.0 (+calendar-sync)' },
    })
    if (!response.ok) {
      throw new Error(`Airbnb answered ${response.status} for the calendar export`)
    }
    return parseIcal(await response.text())
  }

  /**
   * Is Airbnb holding any of these nights, right now?
   *
   * The periodic import is a net with fifteen-minute holes in it. This asks the
   * live calendar in the seconds before a booking is confirmed, which is the
   * only moment the answer is worth anything — Airbnb's feed is generated when
   * requested, so it already knows about a stay somebody booked a minute ago.
   *
   * Returns `null` for "could not tell": no calendar configured, Airbnb slow, or
   * Airbnb down. The caller lets the booking through on `null` **on purpose**.
   * Refusing real money because a third party timed out costs more than the
   * booking it would have prevented, and the import behind it will catch the
   * overlap within the quarter hour and raise it.
   */
  async takenOnAirbnb(
    checkIn: string,
    checkOut: string,
    timeoutMs = 3_000,
  ): Promise<boolean | null> {
    const settings = await this.prisma.siteSettings.findUnique({ where: { id: SETTINGS_ID } })
    const url = settings?.airbnbIcalUrl?.trim()
    if (!url) return null

    try {
      const blocks = await this.fetchBlocks(url, timeoutMs)
      // `endDate` is the last night; a guest leaving the morning a block starts
      // is not an overlap.
      return blocks.some((block) => block.startDate < checkOut && block.endDate >= checkIn)
    } catch (error) {
      this.logger.warn(
        `Could not check Airbnb before confirming ${checkIn}-${checkOut}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return null
    }
  }

  /**
   * Pulls Airbnb's calendar into `BlockedDate`.
   *
   * Replace, not merge: every range the feed no longer carries is deleted and
   * every one it does is written. That is what makes a cancelled Airbnb stay
   * give its nights back instead of blocking the house for ever. Only rows with
   * `source: AIRBNB` are ever touched — what the host blocked by hand in the
   * panel is hers, and no import gets to overrule it.
   */
  async importAirbnb(propertySlug: string): Promise<SyncResult | null> {
    const settings = await this.prisma.siteSettings.findUnique({ where: { id: SETTINGS_ID } })
    const url = settings?.airbnbIcalUrl?.trim()
    if (!url) return null

    try {
      const blocks = await this.fetchBlocks(url)
      const result = await this.apply(propertySlug, blocks)
      await this.record(null)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Kept on the row, not only in the log: the panel has to be able to say
      // "this stopped working on Tuesday", which is the whole point of showing
      // the last sync at all.
      await this.record(message)
      this.logger.error(`Airbnb calendar import failed: ${message}`)
      throw error
    }
  }

  private async apply(propertySlug: string, blocks: IcalBlock[]): Promise<SyncResult> {
    const property = await this.prisma.property.findUnique({
      where: { slug: propertySlug },
      select: { id: true },
    })
    if (!property) throw new Error(`Property "${propertySlug}" not found`)

    const seen = blocks.map((block) => block.uid)

    await this.prisma.$transaction([
      this.prisma.blockedDate.deleteMany({
        where: {
          propertyId: property.id,
          source: 'AIRBNB',
          ...(seen.length > 0 ? { NOT: { externalId: { in: seen } } } : {}),
        },
      }),
      ...blocks.map((block) =>
        this.prisma.blockedDate.upsert({
          where: {
            propertyId_externalId: { propertyId: property.id, externalId: block.uid },
          },
          create: {
            propertyId: property.id,
            startDate: new Date(`${block.startDate}T00:00:00Z`),
            endDate: new Date(`${block.endDate}T00:00:00Z`),
            source: 'AIRBNB',
            externalId: block.uid,
            // No guest data, and nothing the feed said about who booked: the
            // panel needs to know where the block came from, not who is in it.
            reason: 'Airbnb',
          },
          update: {
            startDate: new Date(`${block.startDate}T00:00:00Z`),
            endDate: new Date(`${block.endDate}T00:00:00Z`),
          },
        }),
      ),
    ])

    const collisions = await this.collisions(property.id, blocks)
    if (collisions.length > 0) {
      this.logger.warn(
        `Airbnb overlaps ${collisions.length} direct booking(s): ${collisions
          .map((booking) => booking.reference)
          .join(', ')}`,
      )
    }

    return {
      blocks: blocks.length,
      nights: blocks.reduce((total, block) => total + nightsIn(block), 0),
      collisions,
    }
  }

  /**
   * Direct bookings sitting under something Airbnb has taken.
   *
   * A cancelled booking gives its nights back, and a hold whose payment window
   * ran out never had them — the same two exclusions the calendar itself uses,
   * or every abandoned checkout would be reported as a double booking.
   */
  private async collisions(propertyId: string, blocks: IcalBlock[]) {
    if (blocks.length === 0) return []

    const bookings = await this.prisma.booking.findMany({
      where: {
        propertyId,
        status: { not: 'CANCELLED' },
        NOT: { status: 'PENDING', expiresAt: { lt: new Date() } },
        OR: blocks.map((block) => ({
          // Half-open against the block's inclusive end: a guest leaving on the
          // morning the block starts is not a collision.
          checkIn: { lte: new Date(`${block.endDate}T00:00:00Z`) },
          checkOut: { gt: new Date(`${block.startDate}T00:00:00Z`) },
        })),
      },
      select: { reference: true, checkIn: true, checkOut: true },
    })

    return bookings.map((booking) => ({
      reference: booking.reference,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
    }))
  }

  private record(error: string | null) {
    return this.prisma.siteSettings.update({
      where: { id: SETTINGS_ID },
      data: { airbnbSyncedAt: new Date(), airbnbSyncError: error },
    })
  }
}

const nightsIn = (block: IcalBlock) =>
  (Date.parse(`${block.endDate}T00:00:00Z`) - Date.parse(`${block.startDate}T00:00:00Z`)) /
    86_400_000 +
  1
