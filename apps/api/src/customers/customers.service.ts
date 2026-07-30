import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface GuestSummary {
  id: string
  name: string
  email: string
  phone: string
  country: string
  /** Stays that were actually paid for. A cancelled booking is not a visit. */
  stays: number
  nights: number
  totalSpent: number
  firstStay: string | null
  lastStay: string | null
  /** Their next arrival, when there is one. */
  upcoming: { reference: string; checkIn: string; checkOut: string } | null
  notes: string | null
}

const iso = (date: Date) => date.toISOString().slice(0, 10)

/**
 * The people who have stayed, built from their bookings.
 *
 * A Customer row exists from the moment someone starts a checkout, so it is
 * not the same as a guest: an abandoned hold leaves a row behind. Anyone with
 * no booking that survived is left out, because a list padded with people who
 * never came is a list nobody trusts.
 */
@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<GuestSummary[]> {
    const customers = await this.prisma.customer.findMany({
      include: {
        bookings: {
          where: {
            status: { not: 'CANCELLED' },
            NOT: { status: 'PENDING', expiresAt: { lt: new Date() } },
          },
          orderBy: { checkIn: 'asc' },
        },
      },
    })

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    return customers
      .filter((customer) => customer.bookings.length > 0)
      .map((customer) => {
        const nights = customer.bookings.reduce(
          (sum, booking) =>
            sum + Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000),
          0,
        )
        // Only money that actually arrived. A hold in flight is not revenue.
        const totalSpent = customer.bookings
          .filter((booking) => booking.paidAt)
          .reduce((sum, booking) => sum + Number(booking.totalPrice), 0)

        const next = customer.bookings.find((booking) => booking.checkIn >= today)

        return {
          id: customer.id,
          name: `${customer.firstName} ${customer.lastName}`,
          email: customer.email,
          phone: customer.phone,
          country: customer.country,
          stays: customer.bookings.length,
          nights,
          totalSpent,
          firstStay: iso(customer.bookings[0].checkIn),
          lastStay: iso(customer.bookings[customer.bookings.length - 1].checkIn),
          upcoming: next
            ? {
                reference: next.reference,
                checkIn: iso(next.checkIn),
                checkOut: iso(next.checkOut),
              }
            : null,
          notes: customer.notes,
        }
      })
      .sort((a, b) => (b.lastStay ?? '').localeCompare(a.lastStay ?? ''))
  }
}
