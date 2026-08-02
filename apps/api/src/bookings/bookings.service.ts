import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { Booking, BookingStatus, Customer, Prisma } from '@prisma/client'
import {
  PANEL_HOLD_TTL_MINUTES,
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
import { CreateManualBookingDto } from './dto/manual-booking.dto'
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

/** A stay the host typed in. Null `checkoutUrl` means the money is already in. */
export interface ManualBookingResult {
  bookingId: string
  reference: string
  quote: QuoteBreakdown
  checkoutUrl: string | null
  expiresAt: string | null
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
    //
    // The minimum comes from the quote: it knows which season the arrival date
    // falls in, and a peak week can ask for more nights than the house does.
    const lengthProblem = checkStayLength(quote.nights, {
      minNights: quote.minNights,
      maxNights: property.maxNights,
    })
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

  /**
   * A stay taken over the phone.
   *
   * The same price, the same exclusion constraint, the same customer row as a
   * booking made on the site — only the way the money arrives is different. The
   * host still never sends a total: this prices the stay from the dates and the
   * party, exactly as the public quote does.
   *
   * The length limits are deliberately **not** enforced. They exist to stop a
   * stranger booking a single night over Christmas; the person on the phone is
   * the one who set them, and refusing her own exception would be the software
   * arguing with its owner.
   */
  async createManual(
    slug: string,
    dto: CreateManualBookingDto,
    origin: string,
  ): Promise<ManualBookingResult> {
    const quote = await this.properties.getQuote(slug, {
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      guests: dto.guests,
      extraIds: dto.extraIds,
      extraUnits: dto.extraUnits,
    })

    const property = await this.prisma.property.findUnique({
      where: { slug },
      select: { id: true, checkInTime: true, checkOutTime: true },
    })
    if (!property) throw new NotFoundException(`Property "${slug}" not found`)

    // A blocked date is not a booking, so the constraint knows nothing about
    // it. The host can still block first and book after — this only refuses
    // the collision, not the intent.
    const blocked = await this.prisma.blockedDate.findFirst({
      where: {
        propertyId: property.id,
        startDate: { lt: new Date(dto.checkOut) },
        endDate: { gt: new Date(dto.checkIn) },
      },
    })
    if (blocked) {
      throw new ConflictException('Those dates are blocked. Free them first.')
    }

    const collected = dto.paymentMethod !== undefined
    // Paid in cash holds for ever; a payment link holds for a day, because the
    // guest has to find the email and their card after hanging up.
    const expiresAt = collected ? null : new Date(Date.now() + PANEL_HOLD_TTL_MINUTES * 60_000)

    for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt += 1) {
      try {
        return await this.insertManual(property, dto, quote, expiresAt, origin)
      } catch (error) {
        if (this.isOverlap(error)) {
          throw new ConflictException('Those dates are already taken')
        }
        if (this.isReferenceCollision(error) && attempt < REFERENCE_ATTEMPTS - 1) continue
        throw error
      }
    }
    throw new ConflictException('Could not allocate a booking reference')
  }

  private async insertManual(
    property: { id: string; checkInTime: string; checkOutTime: string },
    dto: CreateManualBookingDto,
    quote: QuoteBreakdown,
    expiresAt: Date | null,
    origin: string,
  ): Promise<ManualBookingResult> {
    const reference = generateReference()
    const collected = dto.paymentMethod !== undefined

    const booking = await this.prisma.$transaction(async (tx) => {
      // Same sweep as a website hold: the constraint cannot call now(), so
      // expired holds still occupy their dates until something cancels them.
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
          propertyId: property.id,
          customerId: customer.id,
          reference,
          checkIn: new Date(dto.checkIn),
          checkOut: new Date(dto.checkOut),
          adults: dto.guests.adults,
          children: dto.guests.children,
          infants: dto.guests.infants,
          pets: dto.guests.pets ?? 0,
          source: 'PANEL',
          // Cash in hand is a confirmed stay, not a hold waiting on Stripe.
          status: collected ? 'CONFIRMED' : 'PENDING',
          paidAt: collected ? new Date() : null,
          paymentMethod: dto.paymentMethod ?? null,
          totalPrice: quote.total,
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
        include: { customer: true, extras: { include: { extra: true } } },
      })
    })

    const notice = this.noticeFor(booking)

    if (collected) {
      // Already paid, so the guest gets the same confirmation a website
      // booking would send them. Nothing about how it was paid changes what
      // they need to know.
      await this.notifications.guestConfirmation({
        ...notice,
        locale: booking.locale,
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
      })
      return { bookingId: booking.id, reference, quote, checkoutUrl: null, expiresAt: null }
    }

    // Same reasoning as a website hold: a link that could not be created is a
    // day of the calendar closed for nothing.
    let checkoutUrl: string
    try {
      const stripeCustomerId = await this.stripeCustomerFor(booking.customer)
      checkoutUrl = await this.payments.checkoutUrlFor({
        bookingId: booking.id,
        reference,
        email: dto.guest.email,
        stripeCustomerId: stripeCustomerId ?? undefined,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        nights: quote.nights,
        total: quote.total,
        guests: dto.guests.adults + dto.guests.children,
        origin,
        ttlMinutes: PANEL_HOLD_TTL_MINUTES,
      })
    } catch (error) {
      await this.discardHold(booking.id, 'No se pudo abrir el pago')
      throw error
    }

    await this.prisma.booking.update({ where: { id: booking.id }, data: { checkoutUrl } })

    return {
      bookingId: booking.id,
      reference,
      quote,
      checkoutUrl,
      expiresAt: expiresAt?.toISOString() ?? null,
    }
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
        // The guest comes back with it: the next step needs their Stripe
        // customer, and a second query for a row we just wrote is waste.
        include: { customer: true },
      })
    })

    // Stripe last, and outside the transaction: it is a network call to
    // someone else's service, and holding a database transaction open across
    // it would be a lock on the whole calendar for as long as Stripe takes.
    //
    // But the row is already committed by now, so a Stripe that refuses would
    // leave the week closed for half an hour over a payment page nobody ever
    // saw. The hold only earns its dates once there is somewhere to pay.
    let checkoutUrl: string
    try {
      const stripeCustomerId = await this.stripeCustomerFor(booking.customer)

      checkoutUrl = await this.payments.checkoutUrlFor({
        bookingId: booking.id,
        reference: booking.reference,
        email: dto.guest.email,
        stripeCustomerId: stripeCustomerId ?? undefined,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        nights: quote.nights,
        total: quote.total,
        guests: dto.guests.adults + dto.guests.children,
        origin,
      })
    } catch (error) {
      await this.discardHold(booking.id, 'No se pudo abrir el pago')
      throw error
    }

    return {
      bookingId: booking.id,
      reference: booking.reference,
      expiresAt: expiresAt.toISOString(),
      quote,
      checkoutUrl,
    }
  }

  /**
   * The one Stripe customer this guest owns, made on their first payment.
   *
   * Kept on our side of the line because Stripe will not do it: it never
   * deduplicates by email, so left to itself a guest with three stays becomes
   * three customer records and a Dashboard-only "guest" grouping on top. The
   * id lives on our Customer row, so the second booking finds the first one's
   * customer instead of minting another.
   */
  private async stripeCustomerFor(customer: Customer): Promise<string | null> {
    if (customer.stripeCustomerId) return customer.stripeCustomerId

    const created = await this.payments.ensureCustomer({
      email: customer.email,
      name: `${customer.firstName} ${customer.lastName}`,
      phone: customer.phone,
    })
    if (!created) return null

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { stripeCustomerId: created },
    })
    this.logger.log(`Created the Stripe customer for ${customer.email}`)
    return created
  }

  /**
   * Gives the dates straight back.
   *
   * For a hold that never became payable — Stripe refused, or the guest turned
   * round at the payment page. Nothing is announced: the guest is looking at
   * the error, or at the calendar they just came back to, and an email saying
   * their booking was cancelled would be news about something that never
   * existed.
   */
  private async discardHold(bookingId: string, reason: string): Promise<void> {
    try {
      await this.prisma.booking.updateMany({
        // `updateMany` with the guard in the filter, so a hold that got paid
        // in the meantime cannot be swept by a late failure.
        where: { id: bookingId, status: 'PENDING', paidAt: null },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason,
          expiresAt: null,
          checkoutUrl: null,
        },
      })
      this.logger.log(`Discarded hold ${bookingId}: ${reason}`)
    } catch (error) {
      // Never masks the original failure: the caller is already throwing, and
      // the sweep will free these dates within the half hour anyway.
      this.logger.error(
        `Could not discard hold ${bookingId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      )
    }
  }

  /**
   * The guest turned back at the payment page.
   *
   * Public, and safe to be: it needs the booking's id, only touches a hold
   * that is still unpaid, and the worst a guessed id achieves is freeing dates
   * that were going to be freed within the half hour regardless.
   */
  async abandonHold(bookingId: string): Promise<void> {
    await this.discardHold(bookingId, 'El huésped volvió atrás desde el pago')
  }

  /**
   * The money arrived. Called only from the verified Stripe webhook.
   *
   * Idempotent, because Stripe retries a webhook it did not get a 2xx for and
   * will happily deliver the same event twice.
   */
  async confirmPayment(
    bookingId: string,
    sessionId: string,
    amountPaid: number,
    paymentIntentId?: string,
  ): Promise<void> {
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
          // What a refund will be issued against, months from now. Stored at
          // the one moment Stripe is definitely telling us about this charge.
          stripePaymentIntentId: paymentIntentId ?? undefined,
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
        await this.confirmPayment(
          status.bookingId,
          sessionId,
          status.amountTotal,
          status.paymentIntentId,
        )

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
      /** WEBSITE or PANEL. A phone booking never shows in Stripe's ledger. */
      source: string
      expiresAt: string | null
      /** Null means never paid, whatever the status says. */
      paidAt: string | null
      /** What has already gone back, so the row can say it without a second call. */
      refunded: number
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
      include: {
        customer: true,
        extras: { include: { extra: true } },
        // A failed refund returned nothing, so it is not money that left.
        refunds: { where: { status: { not: 'FAILED' } }, select: { amount: true } },
      },
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
      source: booking.source,
      expiresAt: booking.expiresAt?.toISOString() ?? null,
      paidAt: booking.paidAt?.toISOString() ?? null,
      refunded: booking.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0),
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

    const notice = this.noticeFor(booking)
    await this.notifications.bookingCancelled(notice, reason)
    // The guest first heard about this by turning up. Now they are told, in
    // their own language, and told whether money is coming back.
    await this.notifications.guestCancellation({
      ...notice,
      locale: booking.locale,
      reason,
      // Truthiness, not `!== null`: an absent field is not the same as a null
      // one, and only one of the two means "they paid".
      paid: Boolean(booking.paidAt),
    })
    // The refund itself is still a decision, not a side effect of this click:
    // the panel offers it next, with the policy's figure already worked out.
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
