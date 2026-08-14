import { CalendarSyncService } from './calendar-sync.service'
import type { PrismaService } from '../prisma/prisma.service'

const ICAL = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260814',
  'DTEND;VALUE=DATE:20260822',
  'SUMMARY:Reserved',
  'UID:evento-uno@airbnb.com',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

type PrismaMock = {
  siteSettings: { findUnique: jest.Mock; update: jest.Mock }
  property: { findUnique: jest.Mock }
  blockedDate: { deleteMany: jest.Mock; upsert: jest.Mock }
  booking: { findMany: jest.Mock }
  $transaction: jest.Mock
}

describe('CalendarSyncService', () => {
  let prisma: PrismaMock
  let service: CalendarSyncService

  const respondWith = (body: string, ok = true, status = 200) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      status,
      text: async () => body,
    }) as unknown as typeof fetch
  }

  beforeEach(() => {
    prisma = {
      siteSettings: {
        findUnique: jest.fn().mockResolvedValue({ airbnbIcalUrl: 'https://airbnb.test/cal.ics' }),
        update: jest.fn().mockResolvedValue({}),
      },
      property: { findUnique: jest.fn().mockResolvedValue({ id: 'prop-1' }) },
      blockedDate: { deleteMany: jest.fn(), upsert: jest.fn() },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockResolvedValue([]),
    }
    service = new CalendarSyncService(prisma as unknown as PrismaService)
    respondWith(ICAL)
  })

  it('does nothing at all when no calendar is configured', async () => {
    prisma.siteSettings.findUnique.mockResolvedValue({ airbnbIcalUrl: '  ' })

    expect(await service.importAirbnb('areia-bela')).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('stores the stay as nights, ending before the check-out day', async () => {
    const result = await service.importAirbnb('areia-bela')

    expect(result).toMatchObject({ blocks: 1, nights: 8 })
    expect(prisma.blockedDate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          propertyId_externalId: { propertyId: 'prop-1', externalId: 'evento-uno@airbnb.com' },
        },
        create: expect.objectContaining({
          startDate: new Date('2026-08-14T00:00:00Z'),
          endDate: new Date('2026-08-21T00:00:00Z'),
          source: 'AIRBNB',
          reason: 'Airbnb',
        }),
      }),
    )
  })

  it('drops what Airbnb no longer has, and never what the host blocked by hand', async () => {
    await service.importAirbnb('areia-bela')

    expect(prisma.blockedDate.deleteMany).toHaveBeenCalledWith({
      where: {
        propertyId: 'prop-1',
        source: 'AIRBNB',
        NOT: { externalId: { in: ['evento-uno@airbnb.com'] } },
      },
    })
  })

  it('clears every imported block when the calendar comes back empty', async () => {
    // A host who cancels everything on Airbnb gets her nights back here too.
    respondWith('BEGIN:VCALENDAR\r\nEND:VCALENDAR')

    await service.importAirbnb('areia-bela')

    expect(prisma.blockedDate.deleteMany).toHaveBeenCalledWith({
      where: { propertyId: 'prop-1', source: 'AIRBNB' },
    })
  })

  it('reports a direct booking underneath, and does not touch it', async () => {
    prisma.booking.findMany.mockResolvedValue([
      {
        reference: 'AB-4F2K9C',
        checkIn: new Date('2026-08-16T00:00:00Z'),
        checkOut: new Date('2026-08-19T00:00:00Z'),
      },
    ])

    const result = await service.importAirbnb('areia-bela')

    expect(result?.collisions).toEqual([
      { reference: 'AB-4F2K9C', checkIn: '2026-08-16', checkOut: '2026-08-19' },
    ])
  })

  it('ignores cancelled stays and holds that ran out', async () => {
    await service.importAirbnb('areia-bela')

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: 'CANCELLED' },
          NOT: { status: 'PENDING', expiresAt: { lt: expect.any(Date) } },
        }),
      }),
    )
  })

  it('remembers a failure on the row, so the panel can say when it broke', async () => {
    respondWith('', false, 403)

    await expect(service.importAirbnb('areia-bela')).rejects.toThrow('403')
    expect(prisma.siteSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ airbnbSyncError: expect.stringContaining('403') }),
      }),
    )
    // Nothing was written: a calendar that did not arrive is not an empty one.
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('clears the last error once a run succeeds', async () => {
    await service.importAirbnb('areia-bela')

    expect(prisma.siteSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ airbnbSyncError: null }) }),
    )
  })
})
