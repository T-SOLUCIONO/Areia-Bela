import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Booking, BookingStatus, Customer, Prisma } from '@prisma/client'
import { generateReference, HOLD_TTL_MINUTES, type QuoteBreakdown } from '@areia-bela/shared'
import { PrismaService } from '../prisma/prisma.service'
import { PropertiesService } from '../properties/properties.service'
import { NotificationsService } from '../notifications/notifications.service'
import { CreateHoldDto } from './dto/create-hold.dto'

/** Postgres' code for a violated exclusion constraint — two overlapping stays. */
const EXCLUSION_VIOLATION = '23P01'

/** How many times a reference collision is retried before giving up. */
const REFERENCE_ATTEMPTS = 5

export interface HoldResult {
  bookingId: string
  reference: string
  expiresAt: string
  quote: QuoteBreakdown
}

type BookingWithGuest = Booking & { customer: Customer; extras: Array<{ extra: { name: string } }> }

const iso = (date: Date): string => date.toISOString().slice(0, 10)

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly properties: PropertiesService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Takes the dates off the calendar while the guest pays.
   *
   * The booking is created PENDING with an expiry. It becomes real only when
   * Stripe says the money arrived — a browser cannot confirm its own booking,
   * which is why nothing here trusts a success redirect.
   */
  async hold(slug: string, dto: CreateHoldDto): Promise<HoldResult> {
    // Prices the stay and rejects impossible ones (bad dates, over capacity).
    // The same call the quote endpoint makes, so the figure the guest saw and
    // the figure Stripe charges come from one place.
    const quote = await this.properties.getQuote(slug, {
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      guests: dto.guests,
      extraIds: dto.extraIds,
      extraUnits: dto.extraUnits,
    })

    const property = await this.prisma.property.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!property) throw new NotFoundException(`Property "${slug}" not found`)

    // A date the host blocked is not a booking, so the exclusion constraint
    // knows nothing about it. This check does.
    const blocked = await this.prisma.blockedDate.findFirst({
      where: {
        propertyId: property.id,
        startDate: { lt: new Date(dto.checkOut) },
        endDate: { gt: new Date(dto.checkIn) },
      },
    })
    if (blocked) {
      throw new ConflictException('Those dates are not available')
    }

    const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60_000)

    for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt += 1) {
      try {
        return await this.createHold(property.id, dto, quote, expiresAt)
      } catch (error) {
        if (this.isOverlap(error)) {
          // Someone else got these dates first. This is the only honest answer:
          // the guest has not been charged and the calendar will show it taken.
          throw new ConflictException('Those dates were just taken')
        }
        if (this.isReferenceCollision(error) && attempt < REFERENCE_ATTEMPTS - 1) {
          continue
        }
        throw error
      }
    }

    // Unreachable in practice: six characters out of 31 collide about once in
    // 887 million, and five draws in a row is not a thing that happens.
    throw new ConflictException('Could not allocate a booking reference')
  }

  private async createHold(
    propertyId: string,
    dto: CreateHoldDto,
    quote: QuoteBreakdown,
    expiresAt: Date,
  ): Promise<HoldResult> {
    const reference = generateReference()

    const booking = await this.prisma.$transaction(async (tx) => {
      // Expired holds still occupy their dates as far as the constraint is
      // concerned: its predicate cannot call now(), because an index expression
      // has to be immutable. Cancelling them here, inside the same transaction
      // as the insert, is what keeps the two views of "taken" in agreement.
      await tx.booking.updateMany({
        where: { status: 'PENDING', expiresAt: { lt: new Date() } },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: 'El plazo de pago venció',
        },
      })

      const customer = await tx.customer.upsert({
        where: { email: dto.guest.email },
        // A returning guest keeps their row and their booking history; the
        // details they typed this time are the current ones.
        update: {
          firstName: dto.guest.firstName,
          lastName: dto.guest.lastName,
          phone: dto.guest.phone,
          country: dto.guest.country,
        },
        create: {
          firstName: dto.guest.firstName,
          lastName: dto.guest.lastName,
          email: dto.guest.email,
          phone: dto.guest.phone,
          country: dto.guest.country,
        },
      })

      return tx.booking.create({
        data: {
          propertyId,
          customerId: customer.id,
          reference,
          checkIn: new Date(dto.checkIn),
          checkOut: new Date(dto.checkOut),
          adults: dto.guests.adults,
          children: dto.guests.children,
          infants: dto.guests.infants,
          pets: dto.guests.pets ?? 0,
          status: 'PENDING',
          totalPrice: quote.total,
          expiresAt,
          specialRequests: dto.specialRequests,
          locale: dto.locale ?? 'es',
          extras: {
            create: quote.extras.map((extra) => ({
              extraId: extra.id,
              quantity: extra.quantity,
            })),
          },
        },
      })
    })

    return {
      bookingId: booking.id,
      reference: booking.reference,
      expiresAt: expiresAt.toISOString(),
      quote,
    }
  }

  /**
   * The money arrived. Called only from the verified Stripe webhook.
   *
   * Idempotent, because Stripe retries a webhook it did not get a 2xx for and
   * will happily deliver the same event twice.
   */
  async confirmPayment(bookingId: string, sessionId: string, amountPaid: number): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        extras: { include: { extra: true } },
        property: { select: { checkInTime: true, checkOutTime: true } },
      },
    })

    if (!booking) {
      // Money with no booking to attach it to. Loud, because it needs a human.
      this.logger.error(`Paid session ${sessionId} references unknown booking ${bookingId}`)
      return
    }

    if (booking.status === 'CONFIRMED') {
      this.logger.log(`Booking ${booking.reference} already confirmed; ignoring repeat webhook`)
      return
    }

    const expected = Math.round(Number(booking.totalPrice) * 100)
    if (amountPaid !== expected) {
      // Not a reason to refuse the booking: the guest paid and holding their
      // dates hostage over a rounding mismatch would be worse. But someone has
      // to look at it.
      this.logger.error(
        `Booking ${booking.reference}: charged ${amountPaid} but priced ${expected}`,
      )
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        stripeSessionId: sessionId,
        paidAt: new Date(),
        // A confirmed stay does not expire. Leaving this set would make the
        // sweep in hold() cancel a paid booking.
        expiresAt: null,
      },
    })

    const notice = this.noticeFor(booking)
    // The host first: they are the one who has to act on it. Then the guest,
    // whose confirmation page already promised them this email.
    await this.notifications.bookingCreated(notice)
    await this.notifications.guestConfirmation({
      ...notice,
      locale: booking.locale,
      checkInTime: booking.property.checkInTime,
      checkOutTime: booking.property.checkOutTime,
    })
  }

  /** The guest walked away from the payment page. The dates go back. */
  async releaseHold(bookingId: string, reason: string): Promise<void> {
    const { count } = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason },
    })
    if (count) this.logger.log(`Released hold ${bookingId}: ${reason}`)
  }

  /** What the confirmation page shows. Keyed by the Stripe session id, which
   * only the guest who paid ever sees. */
  async findBySession(sessionId: string): Promise<{
    reference: string
    checkIn: string
    checkOut: string
    nights: number
    guests: number
    total: number
    guestName: string
    guestEmail: string
    status: BookingStatus
    checkInTime: string
    checkOutTime: string
  }> {
    const booking = await this.prisma.booking.findUnique({
      where: { stripeSessionId: sessionId },
      // The arrival times belong to the house and are editable in the panel.
      // Sent with the booking so the confirmation page has no reason to
      // hard-code them, which is how it ended up claiming 4:00 PM.
      include: {
        customer: true,
        extras: { include: { extra: true } },
        property: { select: { checkInTime: true, checkOutTime: true } },
      },
    })
    if (!booking) throw new NotFoundException('Booking not found')

    const notice = this.noticeFor(booking)
    return {
      reference: notice.reference,
      checkIn: notice.checkIn,
      checkOut: notice.checkOut,
      nights: notice.nights,
      guests: notice.guests,
      total: notice.total,
      guestName: notice.guestName,
      guestEmail: notice.guestEmail,
      status: booking.status,
      checkInTime: booking.property.checkInTime,
      checkOutTime: booking.property.checkOutTime,
    }
  }

  /** Every booking that matters to the host: holds in flight and real stays. */
  async list(): Promise<
    Array<{
      id: string
      reference: string
      checkIn: string
      checkOut: string
      nights: number
      guests: number
      pets: number
      total: number
      status: BookingStatus
      expiresAt: string | null
      guestName: string
      guestEmail: string
      guestPhone: string
      extras: string[]
      specialRequests: string | null
      createdAt: string
    }>
  > {
    const bookings = await this.prisma.booking.findMany({
      // An expired hold is noise: it never became a stay and its dates are free.
      where: {
        NOT: { status: 'PENDING', expiresAt: { lt: new Date() } },
      },
      include: { customer: true, extras: { include: { extra: true } } },
      orderBy: { checkIn: 'asc' },
    })

    return bookings.map((booking) => ({
      id: booking.id,
      reference: booking.reference,
      checkIn: iso(booking.checkIn),
      checkOut: iso(booking.checkOut),
      nights: this.nightsOf(booking),
      guests: booking.adults + booking.children,
      pets: booking.pets,
      total: Number(booking.totalPrice),
      status: booking.status,
      expiresAt: booking.expiresAt?.toISOString() ?? null,
      guestName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      guestEmail: booking.customer.email,
      guestPhone: booking.customer.phone,
      extras: booking.extras.map((line) => line.extra.name),
      specialRequests: booking.specialRequests,
      createdAt: booking.createdAt.toISOString(),
    }))
  }

  /** The host cancels a stay from the panel. The nights go back on sale. */
  async cancel(id: string, reason?: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { customer: true, extras: { include: { extra: true } } },
    })
    if (!booking) throw new NotFoundException('Booking not found')
    if (booking.status === 'CANCELLED') return

    await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
        expiresAt: null,
      },
    })

    await this.notifications.bookingCancelled(this.noticeFor(booking), reason)
    // Refunds are not automated: money going back out is a decision, not a
    // side effect of a click. Declared in docs/changelog.md.
  }

  private nightsOf(booking: { checkIn: Date; checkOut: Date }): number {
    return Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000)
  }

  private noticeFor(booking: BookingWithGuest) {
    return {
      reference: booking.reference,
      guestName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      guestEmail: booking.customer.email,
      checkIn: iso(booking.checkIn),
      checkOut: iso(booking.checkOut),
      nights: this.nightsOf(booking),
      guests: booking.adults + booking.children,
      total: Number(booking.totalPrice),
      extras: booking.extras.map((line) => line.extra.name),
      note: booking.specialRequests ?? undefined,
    }
  }

  /**
   * Prisma has no error code for an exclusion violation — it only maps unique
   * constraints (P2002) — so the Postgres code has to be dug out of the raw
   * error.
   */
  private isOverlap(error: unknown): boolean {
    const meta = (error as Prisma.PrismaClientKnownRequestError)?.meta as
      { code?: string; constraint?: string } | undefined
    if (meta?.code === EXCLUSION_VIOLATION || meta?.constraint === 'Booking_no_overlap') return true

    const message = error instanceof Error ? error.message : String(error)
    return message.includes(EXCLUSION_VIOLATION) || message.includes('Booking_no_overlap')
  }

  private isReferenceCollision(error: unknown): boolean {
    const known = error as Prisma.PrismaClientKnownRequestError
    if (known?.code !== 'P2002') return false
    const target = known.meta?.target
    return Array.isArray(target) ? target.includes('reference') : target === 'reference'
  }
}
