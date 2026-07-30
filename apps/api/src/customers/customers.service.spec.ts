import { CustomersService } from './customers.service'
import type { PrismaService } from '../prisma/prisma.service'

const booking = (over: Partial<Record<string, unknown>> = {}) => ({
  reference: 'AB-AAA111',
  checkIn: new Date('2026-09-01'),
  checkOut: new Date('2026-09-08'),
  totalPrice: 2483,
  paidAt: new Date('2026-08-01'),
  ...over,
})

const customer = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'c1',
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
  let prisma: { customer: { findMany: jest.Mock } }
  let service: CustomersService

  beforeEach(() => {
    prisma = { customer: { findMany: jest.fn().mockResolvedValue([customer()]) } }
    service = new CustomersService(prisma as unknown as PrismaService)
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

  it('leaves out anyone who never actually booked', async () => {
    // A Customer row is written the moment a checkout starts, so an abandoned
    // hold leaves one behind. A guest list padded with people who never came
    // is a list nobody trusts.
    prisma.customer.findMany.mockResolvedValue([customer({ bookings: [] })])

    await expect(service.list()).resolves.toEqual([])
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
})
