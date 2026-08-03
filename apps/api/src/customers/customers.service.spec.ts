import { ConflictException, NotFoundException } from '@nestjs/common'
import { CustomersService } from './customers.service'
import type { GuestAuthService } from '../guest/guest-auth.service'
import type { PrismaService } from '../prisma/prisma.service'

const booking = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'b1',
  reference: 'AB-AAA111',
  checkIn: new Date('2026-09-01'),
  checkOut: new Date('2026-09-08'),
  adults: 2,
  children: 0,
  totalPrice: 2483,
  status: 'CONFIRMED',
  paidAt: new Date('2026-08-01'),
  // Always included by the query, so a fixture without it would be lying
  // about the shape rather than testing the code.
  refunds: [] as Array<{ amount: number }>,
  ...over,
})

const customer = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'c1',
  _count: { bookings: 1 },
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+13055550100',
  country: 'United States',
  notes: null,
  bookings: [booking()],
  ...over,
})

describe('CustomersService', () => {
  let prisma: {
    customer: {
      findMany: jest.Mock
      findUnique?: jest.Mock
      create?: jest.Mock
      update?: jest.Mock
      delete?: jest.Mock
    }
  }
  let guestAuth: { requestLink: jest.Mock }
  let service: CustomersService

  beforeEach(() => {
    prisma = { customer: { findMany: jest.fn().mockResolvedValue([customer()]) } }
    guestAuth = { requestLink: jest.fn().mockResolvedValue(undefined) }
    service = new CustomersService(
      prisma as unknown as PrismaService,
      guestAuth as unknown as GuestAuthService,
    )
  })

  it('adds up stays, nights and what they paid', async () => {
    prisma.customer.findMany.mockResolvedValue([
      customer({
        bookings: [
          booking(),
          booking({
            checkIn: new Date('2026-12-20'),
            checkOut: new Date('2026-12-23'),
            totalPrice: 900,
          }),
        ],
      }),
    ])

    const [guest] = await service.list()
    expect(guest.stays).toBe(2)
    expect(guest.nights).toBe(10)
    expect(guest.totalSpent).toBe(3383)
  })

  it('leaves out the debris of an abandoned checkout', async () => {
    // A hold always writes a booking row, so someone whose only bookings were
    // cancelled started a checkout and walked away. A guest list padded with
    // people who never came is a list nobody trusts.
    prisma.customer.findMany.mockResolvedValue([
      customer({ bookings: [], _count: { bookings: 2 } }),
    ])

    await expect(service.list()).resolves.toEqual([])
  })

  it('keeps a guest the host added by hand', async () => {
    // No bookings at all, ever: nothing else can produce that, and hiding
    // someone the moment they were created would be absurd.
    prisma.customer.findMany.mockResolvedValue([
      customer({ bookings: [], _count: { bookings: 0 } }),
    ])

    const [guest] = await service.list()
    expect(guest.stays).toBe(0)
    expect(guest.firstStay).toBeNull()
  })

  it('lists every stay, newest first, with what went back', async () => {
    prisma.customer.findMany.mockResolvedValue([
      customer({
        bookings: [
          booking({
            reference: 'AB-OLD',
            checkIn: new Date('2026-03-01'),
            checkOut: new Date('2026-03-04'),
          }),
          booking({
            reference: 'AB-NEW',
            checkIn: new Date('2026-09-01'),
            checkOut: new Date('2026-09-08'),
            refunds: [{ amount: 500 }],
          }),
        ],
      }),
    ])

    const [guest] = await service.list()

    // Newest first: what someone opening a guest wants is the last visit.
    expect(guest.stayHistory.map((stay) => stay.reference)).toEqual(['AB-NEW', 'AB-OLD'])
    expect(guest.stayHistory[0].nights).toBe(7)
    expect(guest.stayHistory[0].refunded).toBe(500)
    expect(guest.stayHistory[1].refunded).toBe(0)
  })

  it('marks a stay nobody paid for', async () => {
    prisma.customer.findMany.mockResolvedValue([
      customer({ bookings: [booking({ paidAt: null, status: 'PENDING' })] }),
    ])

    const [guest] = await service.list()

    expect(guest.stayHistory[0].paidAt).toBeNull()
    // And it is not counted as money in.
    expect(guest.totalSpent).toBe(0)
  })

  it('counts only money that arrived', async () => {
    // A hold in flight is not revenue.
    prisma.customer.findMany.mockResolvedValue([
      customer({ bookings: [booking({ paidAt: null })] }),
    ])

    const [guest] = await service.list()
    expect(guest.stays).toBe(1)
    expect(guest.totalSpent).toBe(0)
  })

  it('asks Prisma to skip cancelled bookings and expired holds', async () => {
    await service.list()

    const { include } = prisma.customer.findMany.mock.calls[0][0] as {
      include: { bookings: { where: Record<string, unknown> } }
    }
    expect(include.bookings.where.status).toEqual({ not: 'CANCELLED' })
    expect(include.bookings.where.NOT).toEqual({
      status: 'PENDING',
      expiresAt: { lt: expect.any(Date) },
    })
  })

  describe('editing', () => {
    it('refuses to delete a guest who has bookings', async () => {
      // Their row is what a stay hangs off. Deleting it would leave a
      // reservation with nobody's name on it.
      prisma.customer.findUnique = jest
        .fn()
        .mockResolvedValue({ id: 'c1', _count: { bookings: 1 } })
      prisma.customer.delete = jest.fn()

      await expect(service.remove('c1')).rejects.toBeInstanceOf(ConflictException)
      expect(prisma.customer.delete).not.toHaveBeenCalled()
    })

    it('deletes one who never stayed', async () => {
      prisma.customer.findUnique = jest
        .fn()
        .mockResolvedValue({ id: 'c1', _count: { bookings: 0 } })
      prisma.customer.delete = jest.fn().mockResolvedValue({})

      await expect(service.remove('c1')).resolves.toBeUndefined()
      expect(prisma.customer.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
    })

    it('names the duplicate email rather than failing vaguely', async () => {
      prisma.customer.create = jest
        .fn()
        .mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))

      await expect(
        service.create({
          firstName: 'A',
          lastName: 'B',
          email: 'taken@example.com',
          phone: '1',
          country: 'US',
        }),
      ).rejects.toBeInstanceOf(ConflictException)
    })

    it('says so when editing someone who is gone', async () => {
      prisma.customer.update = jest
        .fn()
        .mockRejectedValue(Object.assign(new Error('missing'), { code: 'P2025' }))

      await expect(service.update('ghost', { phone: '2' })).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })
  })

  describe('resending the sign-in link', () => {
    it('goes through the same path as the public request', async () => {
      // One way a link is ever made: same expiry, same single use, same
      // invalidation of whatever was outstanding.
      prisma.customer.findUnique = jest.fn().mockResolvedValue({
        id: 'c1',
        email: 'jane@example.com',
        _count: { bookings: 2 },
      })

      await service.resendLoginLink('c1', 'en')
      expect(guestAuth.requestLink).toHaveBeenCalledWith('jane@example.com', 'en')
    })

    it('refuses for a guest with nothing to look at', async () => {
      prisma.customer.findUnique = jest
        .fn()
        .mockResolvedValue({ id: 'c1', email: 'x@example.com', _count: { bookings: 0 } })

      await expect(service.resendLoginLink('c1', 'es')).rejects.toBeInstanceOf(ConflictException)
      expect(guestAuth.requestLink).not.toHaveBeenCalled()
    })
  })
})
