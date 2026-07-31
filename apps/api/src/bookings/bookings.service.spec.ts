import { ConflictException, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { generateReference } from '@areia-bela/shared'
import { BookingsService } from './bookings.service'
import type { PropertiesService } from '../properties/properties.service'
import type { NotificationsService } from '../notifications/notifications.service'
import type { PaymentsService } from './payments.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { CreateHoldDto } from './dto/create-hold.dto'

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
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+13055550100',
  },
  extras: [{ extra: { name: 'Mascota' } }],
  property: { checkInTime: '16:00', checkOutTime: '10:00' },
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
    customer: { upsert: jest.Mock }
    $transaction: jest.Mock
  }
  let properties: { getQuote: jest.Mock }
  let payments: { checkoutUrlFor: jest.Mock }
  let notifications: {
    bookingCreated: jest.Mock
    bookingCancelled: jest.Mock
    bookingConflict: jest.Mock
    guestConfirmation: jest.Mock
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
      customer: { upsert: jest.fn().mockResolvedValue({ id: 'cust-1' }) },
      // Runs the callback against the same mocks, which is enough to assert
      // what happens inside the transaction and in what order.
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    }
    properties = { getQuote: jest.fn().mockResolvedValue(QUOTE) }
    payments = {
      checkoutUrlFor: jest.fn().mockResolvedValue('https://checkout.stripe.com/c/pay/cs_test_1'),
    }
    notifications = {
      bookingCreated: jest.fn().mockResolvedValue(undefined),
      bookingCancelled: jest.fn().mockResolvedValue(undefined),
      bookingConflict: jest.fn().mockResolvedValue(undefined),
      guestConfirmation: jest.fn().mockResolvedValue(undefined),
    }

    service = new BookingsService(
      prisma as unknown as PrismaService,
      properties as unknown as PropertiesService,
      notifications as unknown as NotificationsService,
      payments as unknown as PaymentsService,
    )
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

  describe('cancelling', () => {
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
