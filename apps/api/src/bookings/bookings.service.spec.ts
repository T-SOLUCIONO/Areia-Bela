import { ConflictException, NotFoundException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { generateReference } from '@areia-bela/shared'
import { BookingsService } from './bookings.service'
import type { PropertiesService } from '../properties/properties.service'
import type { NotificationsService } from '../notifications/notifications.service'
import type { PaymentsService } from './payments.service'
import type { GuestService } from '../guest/guest.service'
import type { BookingPdfService } from '../guest/booking-pdf.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { CalendarSyncService } from '../calendar-sync/calendar-sync.service'
import type { CreateHoldDto } from './dto/create-hold.dto'
import { ManualPaymentMethod } from './dto/manual-booking.dto'

const QUOTE = {
  nights: 7,
  pricePerNight: 350,
  nightly: [],
  extras: [
    {
      id: 'extra-pet',
      label: 'Mascota',
      price: 115,
      pricingType: 'PER_STAY',
      quantity: 1,
      total: 115,
    },
  ],
  subtotal: 2450,
  weeklyDiscount: 245,
  extrasTotal: 115,
  additionalGuestFee: 0,
  cleaningFee: 200,
  serviceFee: 100,
  taxes: 180,
  total: 2800,
}

const ORIGIN = 'http://localhost:3000'

const DTO: CreateHoldDto = {
  checkIn: '2026-09-01',
  checkOut: '2026-09-08',
  guests: { adults: 4, children: 2, infants: 1, pets: 1 },
  guest: {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+13055550100',
    country: 'United States',
  },
  extraIds: ['extra-pet'],
  locale: 'en',
}

const BOOKING_ROW = {
  id: 'booking-1',
  reference: 'AB-XYZ123',
  status: 'PENDING' as const,
  totalPrice: new Prisma.Decimal(2800),
  checkIn: new Date('2026-09-01'),
  checkOut: new Date('2026-09-08'),
  adults: 4,
  children: 2,
  infants: 1,
  pets: 1,
  locale: 'en',
  specialRequests: null,
  createdAt: new Date('2026-07-30'),
  expiresAt: new Date('2026-07-30T12:30:00Z'),
  customer: {
    id: 'cust-1',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+13055550100',
    // Null on a first-time guest; a returning one already has theirs.
    stripeCustomerId: null as string | null,
  },
  extras: [{ extraId: 'extra-pet', quantity: 1, extra: { name: 'Mascota' } }],
  property: { slug: 'areia-bela', checkInTime: '16:00', checkOutTime: '10:00' },
}

/** What Prisma surfaces when the exclusion constraint refuses an overlap. */
const overlapError = () =>
  Object.assign(new Error('...conflicts with existing key...'), {
    code: 'P2010',
    meta: { code: '23P01', constraint: 'Booking_no_overlap' },
  })

describe('BookingsService', () => {
  let prisma: {
    property: { findUnique: jest.Mock }
    blockedDate: { findFirst: jest.Mock }
    booking: {
      create: jest.Mock
      findUnique: jest.Mock
      findMany: jest.Mock
      update: jest.Mock
      updateMany: jest.Mock
    }
    customer: { upsert: jest.Mock; update: jest.Mock; findUnique?: jest.Mock }
    $transaction: jest.Mock
  }
  let properties: { getQuote: jest.Mock }
  let guests: { myBooking: jest.Mock }
  let pdfs: { render: jest.Mock }
  let calendarSync: { takenOnAirbnb: jest.Mock }
  let payments: { checkoutUrlFor: jest.Mock; ensureCustomer: jest.Mock; sessionStatus?: jest.Mock }
  let notifications: {
    bookingCreated: jest.Mock
    bookingCancelled: jest.Mock
    bookingConflict: jest.Mock
    paymentNotCompleted: jest.Mock
    guestConfirmation: jest.Mock
    guestCancellation: jest.Mock
    bookingChanged: jest.Mock
    guestChange: jest.Mock
  }
  let service: BookingsService

  beforeEach(() => {
    prisma = {
      property: { findUnique: jest.fn().mockResolvedValue({ id: 'prop-1' }) },
      blockedDate: { findFirst: jest.fn().mockResolvedValue(null) },
      booking: {
        create: jest.fn().mockResolvedValue(BOOKING_ROW),
        findUnique: jest.fn().mockResolvedValue(BOOKING_ROW),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(BOOKING_ROW),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      customer: {
        upsert: jest.fn().mockResolvedValue({ id: 'cust-1' }),
        update: jest.fn().mockResolvedValue({ id: 'cust-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'cust-1' }),
      },
      // Runs the callback against the same mocks, which is enough to assert
      // what happens inside the transaction and in what order.
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    }
    properties = { getQuote: jest.fn().mockResolvedValue(QUOTE) }
    guests = { myBooking: jest.fn() }
    payments = {
      checkoutUrlFor: jest.fn().mockResolvedValue('https://checkout.stripe.com/c/pay/cs_test_1'),
      ensureCustomer: jest.fn().mockResolvedValue('cus_new_1'),
    }
    notifications = {
      bookingCreated: jest.fn().mockResolvedValue(undefined),
      bookingCancelled: jest.fn().mockResolvedValue(undefined),
      bookingConflict: jest.fn().mockResolvedValue(undefined),
      paymentNotCompleted: jest.fn().mockResolvedValue(undefined),
      guestConfirmation: jest.fn().mockResolvedValue(undefined),
      guestCancellation: jest.fn().mockResolvedValue(undefined),
      bookingChanged: jest.fn().mockResolvedValue(undefined),
      guestChange: jest.fn().mockResolvedValue(undefined),
    }

    pdfs = { render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')) }

    // Null is "could not tell", which is what an unconfigured calendar answers
    // and the state every test that is not about Airbnb wants to be in.
    calendarSync = { takenOnAirbnb: jest.fn().mockResolvedValue(null) }

    service = new BookingsService(
      prisma as unknown as PrismaService,
      properties as unknown as PropertiesService,
      notifications as unknown as NotificationsService,
      payments as unknown as PaymentsService,
      {
        get: (key: string) => (key === 'PUBLIC_SITE_URL' ? 'http://localhost:3000' : undefined),
      } as unknown as ConfigService,
      guests as unknown as GuestService,
      pdfs as unknown as BookingPdfService,
      calendarSync as unknown as CalendarSyncService,
    )
  })

  describe('the PDF attached to the host alert', () => {
    beforeEach(() => {
      guests.myBooking = jest.fn().mockResolvedValue({ reference: 'AB-XYZ123' })
    })

    it('renders it in Spanish, named after the booking', async () => {
      await service.confirmPayment('booking-1', 'cs_test_1', 280_000)

      const [, attachment] = notifications.bookingCreated.mock.calls[0]
      expect(attachment).toMatchObject({
        filename: 'areia-bela-AB-XYZ123.pdf',
        contentType: 'application/pdf',
      })
      // Spanish regardless of the guest's language: this copy goes to the host.
      expect(pdfs.render).toHaveBeenCalledWith(
        expect.anything(),
        'Jane Doe',
        'jane@example.com',
        'es',
      )
    })

    it('still sends the alert when the PDF cannot be rendered', async () => {
      // The alert is the point and the file is a convenience. A host who is not
      // told a booking came in because a PDF library threw is the worse failure
      // by a wide margin.
      pdfs.render = jest.fn().mockRejectedValue(new Error('pdfkit exploded'))

      await service.confirmPayment('booking-1', 'cs_test_1', 280_000)

      expect(notifications.bookingCreated).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'AB-XYZ123' }),
        undefined,
      )
    })

    it('does not confirm the payment a second time to build it', async () => {
      // `findBySession` confirms the payment itself when it cannot find the
      // session, so building the PDF through it would risk a second round of
      // alerts for one booking. The booking in hand is used instead.
      // Whatever `findBySession` would have needed: if the PDF went through it,
      // this would be consulted and the payment confirmed all over again.
      payments.sessionStatus = jest.fn()

      await service.confirmPayment('booking-1', 'cs_test_1', 280_000)

      expect(notifications.bookingCreated).toHaveBeenCalledTimes(1)
      expect(payments.sessionStatus).not.toHaveBeenCalled()
    })
  })

  describe('holding the dates', () => {
    it('prices the stay through the same service the quote endpoint uses', async () => {
      await service.hold('areia-bela', DTO, ORIGIN)

      expect(properties.getQuote).toHaveBeenCalledWith(
        'areia-bela',
        expect.objectContaining({
          checkIn: '2026-09-01',
          checkOut: '2026-09-08',
        }),
      )
      // The stored total is the server's figure, never one from the request.
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalPrice: 2800 }) }),
      )
    })

    it('creates the hold PENDING, with an expiry', async () => {
      const before = Date.now()
      const result = await service.hold('areia-bela', DTO, ORIGIN)

      const { data } = prisma.booking.create.mock.calls[0][0] as {
        data: { status: string; expiresAt: Date }
      }
      expect(data.status).toBe('PENDING')
      expect(data.expiresAt.getTime()).toBeGreaterThan(before)
      expect(result.reference).toBe('AB-XYZ123')
    })

    it('frees expired holds before inserting, in the same transaction', async () => {
      // The exclusion constraint cannot check an expiry — its predicate has to
      // be immutable — so this sweep is the only thing keeping an abandoned
      // checkout from blocking the week forever.
      await service.hold('areia-bela', DTO, ORIGIN)

      expect(prisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      )
      const sweptAt = prisma.booking.updateMany.mock.invocationCallOrder[0]
      const insertedAt = prisma.booking.create.mock.invocationCallOrder[0]
      expect(sweptAt).toBeLessThan(insertedAt)
    })

    it('answers 409 when the database refuses an overlap', async () => {
      prisma.booking.create.mockRejectedValue(overlapError())

      await expect(service.hold('areia-bela', DTO, ORIGIN)).rejects.toBeInstanceOf(
        ConflictException,
      )
    })

    it('refuses dates the host blocked, which no constraint covers', async () => {
      prisma.blockedDate.findFirst.mockResolvedValue({ id: 'blocked-1' })

      await expect(service.hold('areia-bela', DTO, ORIGIN)).rejects.toBeInstanceOf(
        ConflictException,
      )
      expect(prisma.booking.create).not.toHaveBeenCalled()
    })

    it('refuses dates Airbnb is already holding, asked live', async () => {
      // The import runs every quarter of an hour. This is the second before the
      // dates are taken, which is the only moment the answer is worth having.
      calendarSync.takenOnAirbnb.mockResolvedValue(true)

      await expect(service.hold('areia-bela', DTO, ORIGIN)).rejects.toBeInstanceOf(
        ConflictException,
      )
      expect(prisma.booking.create).not.toHaveBeenCalled()
    })

    it('lets the booking through when Airbnb cannot be reached', async () => {
      // Deliberate. Turning away a guest with their card out because a third
      // party timed out costs more than the overlap it would prevent, and the
      // periodic import raises the collision either way.
      calendarSync.takenOnAirbnb.mockResolvedValue(null)

      await expect(service.hold('areia-bela', DTO, ORIGIN)).resolves.toBeDefined()
      expect(prisma.booking.create).toHaveBeenCalled()
    })

    it('looks for blocks that end the day the guest arrives', async () => {
      // `endDate` is inclusive: a block ending on the arrival date closes that
      // night. Asking for `endDate > checkIn` missed it, so a one-night block
      // was invisible to whoever checked in on it — and Airbnb's calendar is
      // full of one-night blocks.
      await service.hold('areia-bela', DTO, ORIGIN)

      expect(prisma.blockedDate.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          endDate: { gte: new Date(DTO.checkIn) },
          startDate: { lt: new Date(DTO.checkOut) },
        }),
      })
    })

    it('retries with a new reference when one collides', async () => {
      prisma.booking.create
        .mockRejectedValueOnce(
          Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['reference'] } }),
        )
        .mockResolvedValue(BOOKING_ROW)

      await expect(service.hold('areia-bela', DTO, ORIGIN)).resolves.toMatchObject({
        reference: 'AB-XYZ123',
      })
      expect(prisma.booking.create).toHaveBeenCalledTimes(2)
    })

    it('keeps a returning guest on their existing customer row', async () => {
      await service.hold('areia-bela', DTO, ORIGIN)

      expect(prisma.customer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'jane@example.com' } }),
      )
    })

    it('rejects an unknown property instead of holding nothing', async () => {
      prisma.property.findUnique.mockResolvedValue(null)

      await expect(service.hold('nope', DTO, ORIGIN)).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('confirming the payment', () => {
    it('marks the booking paid and clears the expiry', async () => {
      await service.confirmPayment('booking-1', 'cs_test_1', 280_000)

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CONFIRMED',
            stripeSessionId: 'cs_test_1',
            // A confirmed stay must not expire, or the next hold's sweep
            // would cancel a booking somebody paid for.
            expiresAt: null,
          }),
        }),
      )
    })

    it('tells the host and the guest', async () => {
      await service.confirmPayment('booking-1', 'cs_test_1', 280_000)

      expect(notifications.bookingCreated).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'AB-XYZ123', total: 2800 }),
        // The PDF rides along as a second argument; what it contains is the
        // subject of the tests below.
        expect.anything(),
      )
      // The guest's copy goes out in the language they booked in.
      expect(notifications.guestConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'en', checkInTime: '16:00' }),
      )
    })

    it('ignores a webhook Stripe already delivered', async () => {
      prisma.booking.findUnique.mockResolvedValue({ ...BOOKING_ROW, status: 'CONFIRMED' })

      await service.confirmPayment('booking-1', 'cs_test_1', 280_000)

      expect(prisma.booking.update).not.toHaveBeenCalled()
      expect(notifications.bookingCreated).not.toHaveBeenCalled()
    })

    it('still confirms when the amount does not match, rather than stranding a paying guest', async () => {
      await service.confirmPayment('booking-1', 'cs_test_1', 100)

      expect(prisma.booking.update).toHaveBeenCalled()
    })

    it('re-confirms a hold that expired before the webhook arrived', async () => {
      // The guest paid at minute 29 and the webhook was slow, so the sweep in
      // a later hold had already cancelled this one. The dates are still free,
      // so it can simply be restored.
      prisma.booking.findUnique.mockResolvedValue({ ...BOOKING_ROW, status: 'CANCELLED' })

      await service.confirmPayment('booking-1', 'cs_test_1', 280_000)

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONFIRMED', cancellationReason: null }),
        }),
      )
      expect(notifications.bookingCreated).toHaveBeenCalled()
    })

    it('alerts the host when the paid dates now belong to someone else', async () => {
      // The same race, except somebody else booked the week in between. There
      // is no code fix for this — the money has to go back — so it has to
      // reach a person instead of dying in a log.
      prisma.booking.findUnique.mockResolvedValue({ ...BOOKING_ROW, status: 'CANCELLED' })
      prisma.booking.update.mockRejectedValue(overlapError())

      await expect(
        service.confirmPayment('booking-1', 'cs_test_1', 280_000),
      ).resolves.toBeUndefined()

      expect(notifications.bookingConflict).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'AB-XYZ123' }),
        'cs_test_1',
      )
      expect(notifications.bookingCreated).not.toHaveBeenCalled()
    })

    it('does not throw when the booking is gone', async () => {
      prisma.booking.findUnique.mockResolvedValue(null)

      await expect(service.confirmPayment('ghost', 'cs_test_1', 100)).resolves.toBeUndefined()
      expect(prisma.booking.update).not.toHaveBeenCalled()
    })
  })

  describe('a payment that never completed', () => {
    it('frees the dates and tells the guest, with a way to try again', async () => {
      // Saying nothing leaves someone who got halfway through checkout
      // assuming they have a booking.
      await service.releaseHold('booking-1', 'El huésped no completó el pago')

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED', checkoutUrl: null }),
        }),
      )
      const [notice, retry] = notifications.paymentNotCompleted.mock.calls[0] as [
        { locale: string },
        string,
      ]
      expect(notice.locale).toBe('en')
      expect(retry).toContain('checkin=2026-09-01')
    })

    it('does nothing to a booking that is no longer pending', async () => {
      // A confirmed stay must never be released by a late expiry webhook.
      prisma.booking.findUnique.mockResolvedValue({ ...BOOKING_ROW, status: 'CONFIRMED' })

      await service.releaseHold('booking-1', 'tarde')

      expect(prisma.booking.update).not.toHaveBeenCalled()
      expect(notifications.paymentNotCompleted).not.toHaveBeenCalled()
    })
  })

  describe('coming back from Stripe', () => {
    it('confirms on the spot when no webhook has arrived', async () => {
      // The guest is standing in front of the confirmation page having just
      // paid. Telling them their booking does not exist while a webhook is in
      // flight — or lost — is the worst answer available.
      prisma.booking.findUnique
        .mockResolvedValueOnce(null) // nothing keyed to this session yet
        .mockResolvedValueOnce(BOOKING_ROW) // the row confirmPayment reads
        .mockResolvedValueOnce({ id: 'booking-1', customerId: 'cust-1', reference: 'AB-XYZ123' })
      payments.sessionStatus = jest
        .fn()
        .mockResolvedValue({ paid: true, bookingId: 'booking-1', amountTotal: 280_000 })
      guests.myBooking = jest.fn().mockResolvedValue({ reference: 'AB-XYZ123' })
      prisma.customer = {
        ...prisma.customer,
        findUnique: jest
          .fn()
          .mockResolvedValue({ firstName: 'Jane', lastName: 'Doe', email: 'j@e.com' }),
      }

      const result = await service.findBySession('cs_test_1')

      expect(payments.sessionStatus).toHaveBeenCalledWith('cs_test_1')
      expect(prisma.booking.update).toHaveBeenCalled()
      expect(result.reference).toBe('AB-XYZ123')
    })

    it('does not confirm a session Stripe says was never paid', async () => {
      prisma.booking.findUnique.mockResolvedValue(null)
      payments.sessionStatus = jest
        .fn()
        .mockResolvedValue({ paid: false, bookingId: 'booking-1', amountTotal: 0 })

      await expect(service.findBySession('cs_test_unpaid')).rejects.toBeInstanceOf(
        NotFoundException,
      )
      expect(prisma.booking.update).not.toHaveBeenCalled()
    })
  })

  describe('a hold that never becomes payable', () => {
    it('gives the dates straight back when Stripe refuses', async () => {
      payments.checkoutUrlFor.mockRejectedValue(new Error('Stripe is down'))

      await expect(service.hold('areia-bela', DTO, ORIGIN)).rejects.toThrow('Stripe is down')

      // The row is committed before Stripe is called, so without this the week
      // stays shut for half an hour over a payment page nobody ever saw.
      expect(prisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'booking-1', status: 'PENDING', paidAt: null },
          data: expect.objectContaining({
            status: 'CANCELLED',
            expiresAt: null,
            cancellationReason: 'No se pudo abrir el pago',
          }),
        }),
      )
    })

    it('frees a hold the guest turned back from', async () => {
      await service.abandonHold('booking-1')

      expect(prisma.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          // Guarded in the filter, so a hold paid in the meantime survives.
          where: { id: 'booking-1', status: 'PENDING', paidAt: null },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      )
    })

    it('never throws while freeing one', async () => {
      prisma.booking.updateMany.mockRejectedValue(new Error('database gone'))

      // The caller is already dealing with a failure, and the sweep frees
      // these dates within the half hour regardless.
      await expect(service.abandonHold('booking-1')).resolves.toBeUndefined()
    })
  })

  describe('a stay taken over the phone', () => {
    const MANUAL = {
      checkIn: '2026-09-01',
      checkOut: '2026-09-08',
      guests: { adults: 4, children: 2, infants: 1, pets: 1 },
      guest: DTO.guest,
      extraIds: ['extra-pet'],
      locale: 'es',
    }

    beforeEach(() => {
      properties.getQuote = jest.fn().mockResolvedValue(QUOTE)
      prisma.property.findUnique.mockResolvedValue({
        id: 'prop-1',
        checkInTime: '16:00',
        checkOutTime: '10:00',
      })
    })

    it('confirms it on the spot when the money is already in hand', async () => {
      const result = await service.createManual(
        'areia-bela',
        { ...MANUAL, paymentMethod: ManualPaymentMethod.CASH },
        ORIGIN,
      )

      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'PANEL',
            status: 'CONFIRMED',
            paymentMethod: 'CASH',
            // A confirmed stay does not expire.
            expiresAt: null,
          }),
        }),
      )
      // No Stripe: there is nothing to charge.
      expect(payments.checkoutUrlFor).not.toHaveBeenCalled()
      expect(result.checkoutUrl).toBeNull()
      expect(notifications.guestConfirmation).toHaveBeenCalled()
    })

    it('opens a day-long payment link when the guest has not paid yet', async () => {
      const result = await service.createManual('areia-bela', MANUAL, ORIGIN)

      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING', paymentMethod: null }),
        }),
      )
      // Half an hour is right for someone on the checkout page and wrong for
      // someone who just hung up.
      expect(payments.checkoutUrlFor).toHaveBeenCalledWith(
        expect.objectContaining({ ttlMinutes: 24 * 60 }),
      )
      expect(result.checkoutUrl).toContain('checkout.stripe.com')
      // Nothing is promised to a guest who has not paid.
      expect(notifications.guestConfirmation).not.toHaveBeenCalled()
    })

    it('prices it on the server, never from the caller', async () => {
      await service.createManual(
        'areia-bela',
        { ...MANUAL, paymentMethod: ManualPaymentMethod.TRANSFER },
        ORIGIN,
      )

      expect(properties.getQuote).toHaveBeenCalledWith(
        'areia-bela',
        expect.objectContaining({ checkIn: '2026-09-01', checkOut: '2026-09-08' }),
      )
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalPrice: QUOTE.total }) }),
      )
    })

    it('refuses dates the host has blocked', async () => {
      prisma.blockedDate.findFirst.mockResolvedValue({ id: 'blocked-1' })

      await expect(service.createManual('areia-bela', MANUAL, ORIGIN)).rejects.toBeInstanceOf(
        ConflictException,
      )
      expect(prisma.booking.create).not.toHaveBeenCalled()
    })

    it('refuses dates somebody already has', async () => {
      prisma.booking.create.mockRejectedValue(overlapError())

      await expect(service.createManual('areia-bela', MANUAL, ORIGIN)).rejects.toBeInstanceOf(
        ConflictException,
      )
    })

    it('takes a stay shorter than the house minimum, because the host said so', async () => {
      // The limits exist to stop a stranger booking one night over Christmas.
      // The person on the phone is the one who set them.
      properties.getQuote = jest.fn().mockResolvedValue({ ...QUOTE, nights: 1, minNights: 5 })

      await expect(
        service.createManual(
          'areia-bela',
          { ...MANUAL, paymentMethod: ManualPaymentMethod.CASH },
          ORIGIN,
        ),
      ).resolves.toBeDefined()
    })
  })

  describe('the guest\u2019s Stripe customer', () => {
    it('creates one on a first payment and remembers it', async () => {
      await service.hold('areia-bela', DTO, ORIGIN)

      expect(payments.ensureCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@example.com', name: 'Jane Doe' }),
      )
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { stripeCustomerId: 'cus_new_1' },
      })
      expect(payments.checkoutUrlFor).toHaveBeenCalledWith(
        expect.objectContaining({ stripeCustomerId: 'cus_new_1' }),
      )
    })

    it('reuses the one a returning guest already has', async () => {
      // The whole point: Stripe never deduplicates by email, so a second
      // booking that asked it for a customer would get a second person.
      prisma.booking.create.mockResolvedValue({
        ...BOOKING_ROW,
        customer: { ...BOOKING_ROW.customer, stripeCustomerId: 'cus_existing' },
      })

      await service.hold('areia-bela', DTO, ORIGIN)

      expect(payments.ensureCustomer).not.toHaveBeenCalled()
      expect(prisma.customer.update).not.toHaveBeenCalled()
      expect(payments.checkoutUrlFor).toHaveBeenCalledWith(
        expect.objectContaining({ stripeCustomerId: 'cus_existing' }),
      )
    })

    it('still opens checkout when Stripe refuses to make a customer', async () => {
      payments.ensureCustomer.mockResolvedValue(null)

      await expect(service.hold('areia-bela', DTO, ORIGIN)).resolves.toBeDefined()
      expect(payments.checkoutUrlFor).toHaveBeenCalledWith(
        expect.objectContaining({ stripeCustomerId: undefined }),
      )
    })
  })

  describe('cancelling', () => {
    it('tells the guest, in their language, that their stay is off', async () => {
      await service.cancel('booking-1', 'Fuga de agua')

      expect(notifications.guestCancellation).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'AB-XYZ123',
          reason: 'Fuga de agua',
          locale: 'en',
        }),
      )
    })

    it('does not promise a refund on a booking nobody paid for', async () => {
      await service.cancel('booking-1')

      expect(notifications.guestCancellation).toHaveBeenCalledWith(
        expect.objectContaining({ paid: false }),
      )
    })

    it('says money is coming back when the stay was paid', async () => {
      prisma.booking.findUnique.mockResolvedValue({ ...BOOKING_ROW, paidAt: new Date() })

      await service.cancel('booking-1')

      expect(notifications.guestCancellation).toHaveBeenCalledWith(
        expect.objectContaining({ paid: true }),
      )
    })

    it('frees the nights and tells the host why', async () => {
      await service.cancel('booking-1', 'Fuga de agua')

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancellationReason: 'Fuga de agua',
          }),
        }),
      )
      expect(notifications.bookingCancelled).toHaveBeenCalledWith(
        expect.objectContaining({ reference: 'AB-XYZ123' }),
        'Fuga de agua',
      )
    })

    it('does nothing twice', async () => {
      prisma.booking.findUnique.mockResolvedValue({ ...BOOKING_ROW, status: 'CANCELLED' })

      await service.cancel('booking-1')

      expect(prisma.booking.update).not.toHaveBeenCalled()
      expect(notifications.bookingCancelled).not.toHaveBeenCalled()
      expect(notifications.guestCancellation).not.toHaveBeenCalled()
    })
  })

  describe('listing for the panel', () => {
    it('leaves out holds that already expired', async () => {
      await service.list()

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            NOT: { status: 'PENDING', expiresAt: { lt: expect.any(Date) } },
          }),
        }),
      )
    })
  })

  describe('moving a stay that already exists', () => {
    /** A paid stay, so a change leaves a balance behind. */
    const PAID = { ...BOOKING_ROW, status: 'CONFIRMED' as const, paidAt: new Date('2026-08-01') }

    beforeEach(() => {
      prisma.booking.findUnique.mockResolvedValue(PAID)
      prisma.property.findUnique.mockResolvedValue({
        slug: 'areia-bela',
        checkInTime: '16:00',
        checkOutTime: '10:00',
      })
    })

    it('recomputes the total on the server', async () => {
      // Whatever a caller believes the new price is, this is where it comes
      // from. The DTO has no field for a total, and this is the reason.
      properties.getQuote.mockResolvedValue({ ...QUOTE, total: 3100 })
      prisma.booking.update.mockResolvedValue({ ...PAID, totalPrice: new Prisma.Decimal(3100) })

      const result = await service.update('booking-1', { checkOut: '2026-09-10' })

      expect(properties.getQuote).toHaveBeenCalledWith(
        'areia-bela',
        expect.objectContaining({ checkIn: '2026-09-01', checkOut: '2026-09-10' }),
      )
      expect(result.quote.total).toBe(3100)
      // The frozen bill is rewritten: it was describing a stay nobody is having.
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalPrice: 3100 }) }),
      )
    })

    it('reports the difference and moves no money', async () => {
      properties.getQuote.mockResolvedValue({ ...QUOTE, total: 3100 })
      prisma.booking.update.mockResolvedValue({ ...PAID, totalPrice: new Prisma.Decimal(3100) })

      const result = await service.update('booking-1', { checkOut: '2026-09-10' })

      expect(result.previousTotal).toBe(2800)
      expect(result.difference).toBe(300)
      // Charging a saved card needs the guest to authorise it, and refunding
      // automatically would bypass the policy ladder. Neither belongs in a PATCH.
      expect(payments.checkoutUrlFor).not.toHaveBeenCalled()
    })

    it('keeps what the caller left out', async () => {
      await service.update('booking-1', { checkOut: '2026-09-10' })

      expect(properties.getQuote).toHaveBeenCalledWith(
        'areia-bela',
        expect.objectContaining({
          // Untouched by this request, so they come off the existing row.
          guests: { adults: 4, children: 2, infants: 1, pets: 1 },
          extraIds: ['extra-pet'],
          extraUnits: { 'extra-pet': 1 },
        }),
      )
    })

    it('refuses dates another booking already holds', async () => {
      // The same 23P01 that protects a new booking protects a moved one: the
      // constraint does not care which row wants the week.
      prisma.booking.update.mockRejectedValue(
        Object.assign(new Error('exclusion'), { code: 'P2010', meta: { code: '23P01' } }),
      )

      await expect(service.update('booking-1', { checkIn: '2026-09-05' })).rejects.toThrow(
        ConflictException,
      )
    })

    it('refuses dates the host has blocked', async () => {
      prisma.blockedDate.findFirst.mockResolvedValue({ id: 'blocked-1' })

      await expect(service.update('booking-1', { checkIn: '2026-12-24' })).rejects.toThrow(
        ConflictException,
      )
      expect(prisma.booking.update).not.toHaveBeenCalled()
    })

    it('refuses to change a cancelled stay', async () => {
      // Its nights are back on sale, so "changing" it would quietly re-take
      // them without anyone deciding to.
      prisma.booking.findUnique.mockResolvedValue({ ...PAID, status: 'CANCELLED' })

      await expect(service.update('booking-1', { checkIn: '2026-09-05' })).rejects.toThrow(
        ConflictException,
      )
    })

    it('tells the host and the guest, with the old dates', async () => {
      properties.getQuote.mockResolvedValue({ ...QUOTE, total: 3100 })
      prisma.booking.update.mockResolvedValue({
        ...PAID,
        totalPrice: new Prisma.Decimal(3100),
        checkOut: new Date('2026-09-10'),
      })

      await service.update('booking-1', { checkOut: '2026-09-10', reason: 'Vuelo retrasado' })

      expect(notifications.bookingChanged).toHaveBeenCalledWith(
        expect.objectContaining({ difference: 300, paid: true, reason: 'Vuelo retrasado' }),
      )
      // The guest gets both, because a message with only the new dates reads
      // like a booking they do not remember making.
      expect(notifications.guestChange).toHaveBeenCalledWith(
        expect.objectContaining({
          previousCheckIn: '2026-09-01',
          previousCheckOut: '2026-09-08',
          checkOut: '2026-09-10',
        }),
      )
    })
  })
})

describe('generateReference', () => {
  it('is short enough to read out loud', () => {
    expect(generateReference()).toMatch(/^AB-[A-Z0-9]{6}$/)
  })

  it('leaves out the characters people mishear over the phone', () => {
    // I, O and S sound or look like digits; 0 and 1 survive bad handwriting no
    // better. 5 stays, because with no S in the alphabet it cannot be mistaken
    // for anything.
    const drawn = Array.from({ length: 300 }, () => generateReference()).join('')
    expect(drawn).not.toMatch(/[IOS01]/)
    expect(drawn).toMatch(/5/)
  })
})
