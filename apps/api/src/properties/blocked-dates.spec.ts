import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { PropertiesService } from './properties.service'
import type { PrismaService } from '../prisma/prisma.service'

/**
 * Closing the house by hand: maintenance, the host's own stay.
 *
 * Nothing in the database stops a block from covering a live booking — the
 * exclusion constraint guards bookings against each other, not against
 * BlockedDate — so every guard here is application code, which is exactly why
 * it needs tests.
 */
const prismaMock = () => ({
  property: { findUnique: jest.fn().mockResolvedValue({ id: 'p1' }) },
  booking: { findFirst: jest.fn().mockResolvedValue(null) },
  blockedDate: {
    create: jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'b1', reason: null, ...data }),
      ),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    findMany: jest.fn().mockResolvedValue([]),
  },
})

describe('PropertiesService — blocking dates', () => {
  let prisma: ReturnType<typeof prismaMock>
  let service: PropertiesService

  beforeEach(() => {
    prisma = prismaMock()
    service = new PropertiesService(prisma as unknown as PrismaService)
  })

  it('stores the range with its reason', async () => {
    const result = await service.blockDates('areia-bela', {
      startDate: '2026-09-10',
      endDate: '2026-09-14',
      reason: 'Pintura de la cocina',
    })

    expect(result.reason).toBe('Pintura de la cocina')
    expect(result.startDate.slice(0, 10)).toBe('2026-09-10')
  })

  it('refuses to hide a booking somebody paid for', async () => {
    prisma.booking.findFirst.mockResolvedValue({ reference: 'AB-XYZ123' })

    await expect(
      service.blockDates('areia-bela', { startDate: '2026-09-01', endDate: '2026-09-05' }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.blockedDate.create).not.toHaveBeenCalled()
  })

  it('ignores holds that already expired when looking for a clash', async () => {
    // An abandoned checkout is not a reason to stop the host closing the week.
    await service.blockDates('areia-bela', { startDate: '2026-09-01', endDate: '2026-09-05' })

    const { where } = prisma.booking.findFirst.mock.calls[0][0] as {
      where: Record<string, unknown>
    }
    expect(where.NOT).toEqual({ status: 'PENDING', expiresAt: { lt: expect.any(Date) } })
    expect(where.status).toEqual({ not: 'CANCELLED' })
  })

  it('lets a block start on a departure morning', async () => {
    // checkOut is not a night. A booking ending the 8th and a block starting
    // the 8th do not overlap, so the query asks for checkOut strictly after
    // the block's start.
    await service.blockDates('areia-bela', { startDate: '2026-09-08', endDate: '2026-09-10' })

    const { where } = prisma.booking.findFirst.mock.calls[0][0] as {
      where: { checkOut: { gt: Date } }
    }
    expect(where.checkOut.gt).toEqual(new Date('2026-09-08'))
  })

  it('rejects a range that ends before it starts', async () => {
    await expect(
      service.blockDates('areia-bela', { startDate: '2026-09-10', endDate: '2026-09-01' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects an unknown property', async () => {
    prisma.property.findUnique.mockResolvedValue(null)

    await expect(
      service.blockDates('nope', { startDate: '2026-09-10', endDate: '2026-09-14' }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('frees a range', async () => {
    await expect(service.unblockDates('b1')).resolves.toBeUndefined()
    expect(prisma.blockedDate.deleteMany).toHaveBeenCalledWith({ where: { id: 'b1' } })
  })

  it('says so when there was nothing to free', async () => {
    prisma.blockedDate.deleteMany.mockResolvedValue({ count: 0 })

    await expect(service.unblockDates('ghost')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('answers with plain days, not with midnight in UTC', async () => {
    // The column is a date. Serialising it as an instant made every browser
    // west of Greenwich draw the block a day early — the range Airbnb closed
    // from 4 to 9 November appeared in the calendar as 3 to 8.
    prisma.blockedDate.findMany.mockResolvedValue([
      {
        id: 'b1',
        propertyId: 'p1',
        startDate: new Date('2026-11-04T00:00:00Z'),
        endDate: new Date('2026-11-04T00:00:00Z'),
        reason: 'Airbnb',
      },
    ])

    const [range] = await service.getBlockedDates('areia-bela')

    expect(range.startDate).toBe('2026-11-04')
    expect(range.endDate).toBe('2026-11-04')
  })
})
