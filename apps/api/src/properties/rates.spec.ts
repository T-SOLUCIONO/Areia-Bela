import { NotFoundException } from '@nestjs/common'
import { PropertiesService } from './properties.service'
import type { PrismaService } from '../prisma/prisma.service'

/**
 * What the public calendar reads: the rate for each night and whether it can
 * still be booked. The availability half is what stops two people booking the
 * same week, so its edges — the check-out day, the inclusive blocked range —
 * are worth pinning down.
 */
const prismaMock = () => ({
  property: { findUnique: jest.fn() },
  booking: { findMany: jest.fn().mockResolvedValue([]) },
  blockedDate: { findMany: jest.fn().mockResolvedValue([]) },
})

const PROPERTY = {
  id: 'p1',
  priceRules: [
    { type: 'LOW', nightlyRate: 300, startDate: null, endDate: null },
    { type: 'WEEKEND', nightlyRate: 380, startDate: null, endDate: null },
  ],
}

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('PropertiesService.getRates', () => {
  let prisma: ReturnType<typeof prismaMock>
  let service: PropertiesService

  beforeEach(() => {
    prisma = prismaMock()
    prisma.property.findUnique.mockResolvedValue(PROPERTY)
    service = new PropertiesService(prisma as unknown as PrismaService)
  })

  it('404s on a property that does not exist', async () => {
    prisma.property.findUnique.mockResolvedValue(null)
    await expect(service.getRates('nope', '2026-09-01', '2026-09-05')).rejects.toThrow(
      NotFoundException,
    )
  })

  it('returns one entry per night, with its own rate', async () => {
    // 2026-09-03 Thursday, 09-04 Friday, 09-05 Saturday.
    const rates = await service.getRates('areia-bela', '2026-09-03', '2026-09-06')

    expect(rates.map((night) => night.date)).toEqual(['2026-09-03', '2026-09-04', '2026-09-05'])
    expect(rates.map((night) => night.rate)).toEqual([300, 380, 380])
  })

  it('marks the nights of a booking as taken', async () => {
    prisma.booking.findMany.mockResolvedValue([
      { checkIn: date('2026-09-02'), checkOut: date('2026-09-04') },
    ])

    const rates = await service.getRates('areia-bela', '2026-09-01', '2026-09-05')
    const taken = rates.filter((night) => !night.available).map((night) => night.date)

    // Two nights slept: the 2nd and the 3rd.
    expect(taken).toEqual(['2026-09-02', '2026-09-03'])
  })

  it('leaves the check-out day bookable', async () => {
    // The departing guest leaves in the morning; the next can arrive that day.
    prisma.booking.findMany.mockResolvedValue([
      { checkIn: date('2026-09-02'), checkOut: date('2026-09-04') },
    ])

    const rates = await service.getRates('areia-bela', '2026-09-01', '2026-09-05')
    expect(rates.find((night) => night.date === '2026-09-04')?.available).toBe(true)
  })

  it('does not free up nights held by a pending booking', async () => {
    // Someone is paying for it right now.
    prisma.booking.findMany.mockResolvedValue([
      { checkIn: date('2026-09-02'), checkOut: date('2026-09-03') },
    ])

    const rates = await service.getRates('areia-bela', '2026-09-01', '2026-09-04')
    expect(rates.find((night) => night.date === '2026-09-02')?.available).toBe(false)
    // The query asks for everything that is not CANCELLED.
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'CANCELLED' } }),
      }),
    )
  })

  it('treats a blocked range as inclusive of its last day', async () => {
    // The host who blocks the 2nd to the 3rd means both days, unlike a booking
    // whose check-out day is free.
    prisma.blockedDate.findMany.mockResolvedValue([
      { startDate: date('2026-09-02'), endDate: date('2026-09-03') },
    ])

    const rates = await service.getRates('areia-bela', '2026-09-01', '2026-09-05')
    const taken = rates.filter((night) => !night.available).map((night) => night.date)

    expect(taken).toEqual(['2026-09-02', '2026-09-03'])
  })

  it('is empty for a range with no nights in it', async () => {
    await expect(service.getRates('areia-bela', '2026-09-01', '2026-09-01')).resolves.toEqual([])
  })
})
