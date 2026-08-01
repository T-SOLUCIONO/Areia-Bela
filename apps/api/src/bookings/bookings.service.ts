import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { Booking, BookingStatus, Customer, Prisma } from '@prisma/client'
import {
  checkStayLength,
  generateReference,
  HOLD_TTL_MINUTES,
  type QuoteBreakdown,
} from '@areia-bela/shared'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { PropertiesService } from '../properties/properties.service'
import { NotificationsService } from '../notifications/notifications.service'
import { CreateHoldDto } from './dto/create-hold.dto'
import { PaymentsService } from './payments.service'
import { GuestService, type MyBooking } from '../guest/guest.service'

/** Postgres' code for a violated exclusion constraint — two overlapping stays. */
const EXCLUSION_VIOLATION = '23P01'

/** How many times a reference collision is retried before giving up. */
const REFERENCE_ATTEMPTS = 5

export interface HoldResult {
  bookingId: string
  reference: string
  expiresAt: string
  quote: QuoteBreakdown
  /** Where to send the guest to pay. */
  checkoutUrl: string
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
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
    private readonly guests: GuestService,
  ) {}

  /**
   * Takes the dates off the calendar while the guest pays.
   *
   * The booking is created PENDING with an expiry. It becomes real only when
   * Stripe says the money arrived — a browser cannot confirm its own booking,
   * which is why nothing here trusts a success redirect.
   */
  async hold(slug: string, dto: CreateHoldDto, origin: string): Promise<HoldResult> {
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
      select: { id: true, minNights: true, maxNights: true },
    })
    if (!property) throw new NotFoundException(`Property "${slug}" not found`)

    // The calendar already stops a guest picking two nights when four are
    // required, but the calendar is a browser. This is the authority.
    const lengthProblem = checkStayLength(quote.nights, property)
    if (lengthProblem) {
      throw new BadRequestException(
        lengthProblem.kind === 'tooShort'
          ? `This house takes bookings of at least ${lengthProblem.minNights} nights`
          : `This house takes bookings of at most ${lengthProblem.maxNights} nights`,
      )
    }

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
        return await this.createHold(property.id, dto, quote, expiresAt, origin)
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
    origin: string,
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
          // Frozen here, not recomputed later: this is the bill, and the bill
          // does not change because the host raised the rate in March.
          nightsSubtotal: quote.subtotal,
          weeklyDiscount: quote.weeklyDiscount,
          extrasTotal: quote.extrasTotal,
          additionalGuestFee: quote.additionalGuestFee,
          cleaningFee: quote.cleaningFee,
          serviceFee: quote.serviceFee,
          taxes: quote.taxes,
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

    // Stripe last, and outside the transaction: it is a network call to
    // someone else's service, and holding a database transaction open across
    // it would be a lock on the whole calendar for as long as Stripe takes.
    const checkoutUrl = await this.payments.checkoutUrlFor({
      bookingId: booking.id,
      reference: booking.reference,
      email: dto.guest.email,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      nights: quote.nights,
      total: quote.total,
      guests: dto.guests.adults + dto.guests.children,
      origin,
    })

    return {
      bookingId: booking.id,
      reference: booking.reference,
      expiresAt: expiresAt.toISOString(),
      quote,
      checkoutUrl,
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

    if (booking.status === 'CANCELLED') {
      // The guest paid, but their hold ran out before the webhook arrived and
      // a later hold swept it. Whether this is recoverable depends on one
      // thing: did anyone else take the dates in the meantime? The exclusion
      // constraint answers that, so let it — the update below either succeeds
      // or throws 23P01.
      this.logger.warn(`Booking ${booking.reference} was cancelled but has now been paid`)
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

    try {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
          stripeSessionId: sessionId,
          paidAt: new Date(),
          // A confirmed stay does not expire. Leaving this set would make the
          // sweep in hold() cancel a booking somebody paid for.
          expiresAt: null,
          // A session that already paid is not a link to hand anyone.
          checkoutUrl: null,
          cancelledAt: null,
          cancellationReason: null,
        },
      })
    } catch (error) {
      if (!this.isOverlap(error)) throw error

      // The worst case the system has: money taken for a week that now belongs
      // to someone else. It cannot be resolved in code — it needs a refund or
      // a phone call — so it goes to the host as an alert rather than dying in
      // a log nobody reads.
      this.logger.error(
        `PAID BUT DOUBLE-BOOKED: ${booking.reference} (${sessionId}) — the dates were taken`,
      )
      await this.notifications.bookingConflict(this.noticeFor(booking), sessionId)
      return
    }

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

  /**
   * The guest walked away from the payment page. The dates go back, and they
   * get told — otherwise they are left assuming they have a booking.
   */
  async releaseHold(bookingId: string, reason: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        extras: { include: { extra: true } },
        property: { select: { slug: true, checkInTime: true, checkOutTime: true } },
      },
    })
    if (!booking || booking.status !== 'PENDING') return

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
        checkoutUrl: null,
      },
    })
    this.logger.log(`Released hold ${booking.reference}: ${reason}`)

    const base = this.config.get<string>('PUBLIC_SITE_URL') ?? 'http://localhost:3000'
    const retry =
      `${base}/${booking.locale}/checkout?checkin=${iso(booking.checkIn)}` +
      `&checkout=${iso(booking.checkOut)}&adults=${booking.adults + booking.children}`

    await this.notifications.paymentNotCompleted(
      {
        ...this.noticeFor(booking),
        locale: booking.locale,
        checkInTime: booking.property.checkInTime,
        checkOutTime: booking.property.checkOutTime,
      },
      retry,
    )
  }

  /**
   * What the confirmation page shows, keyed by the Stripe session id — which
   * reaches nobody but the guest who paid, since it arrives in their return
   * URL.
   *
   * Returns the same shape the guest area uses, plus the name and email. One
   * description of a booking rather than two that drift apart: the guest who
   * just paid should see exactly what they will see when they sign in later.
   */
  async findBySession(
    sessionId: string,
  ): Promise<MyBooking & { guestName: string; guestEmail: string }> {
    let booking = await this.prisma.booking.findUnique({
      where: { stripeSessionId: sessionId },
      select: { id: true, customerId: true, reference: true },
    })

    if (!booking) {
      // The guest is standing in front of this page having just paid, and no
      // webhook has arrived. Rather than tell them their booking does not
      // exist, ask Stripe directly — the session id in their return URL is
      // proof enough to look it up.
      //
      // The background reconciliation still exists for everyone who closed the
      // tab; this is the same recovery, done while someone is waiting.
      const status = await this.payments.sessionStatus(sessionId)
      if (status?.paid && status.bookingId) {
        this.logger.warn(`Confirming ${sessionId} on return: no webhook had arrived`)
        await this.confirmPayment(status.bookingId, sessionId, status.amountTotal)

        booking = await this.prisma.booking.findUnique({
          where: { stripeSessionId: sessionId },
          select: { id: true, customerId: true, reference: true },
        })
      }
    }

    if (!booking) throw new NotFoundException('Booking not found')

    const [detail, customer] = await Promise.all([
      this.guests.myBooking(booking.customerId, booking.reference),
      this.prisma.customer.findUnique({ where: { id: booking.customerId } }),
    ])

    return {
      ...detail,
      guestName: customer ? `${customer.firstName} ${customer.lastName}` : '',
      guestEmail: customer?.email ?? '',
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
