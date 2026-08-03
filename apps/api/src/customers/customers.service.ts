import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto'
import { GuestAuthService } from '../guest/guest-auth.service'

/** One stay, as the guest's own history shows it. */
export interface GuestStay {
  id: string
  reference: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  total: number
  status: string
  /** Null on a hold that was never paid. */
  paidAt: string | null
  /** What has gone back on this stay, so a refunded week does not read as revenue. */
  refunded: number
}

export interface GuestSummary {
  id: string
  firstName: string
  lastName: string
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
  /**
   * Every stay, newest first.
   *
   * The aggregates above answer "how much" and the host still had to go to
   * Reservations and search to answer "which ones". These rows were already
   * loaded here to compute those totals, so sending them costs one more field
   * rather than one more request.
   */
  stayHistory: GuestStay[]
  notes: string | null
}

const iso = (date: Date) => date.toISOString().slice(0, 10)

/**
 * The people who have stayed, built from their bookings.
 *
 * A Customer row exists from the moment someone starts a checkout, so it is
 * not the same as a guest: an abandoned hold leaves a row behind. Those are
 * left out, because a list padded with people who never came is a list nobody
 * trusts — but someone the host added by hand has no bookings at all, and
 * hiding them the moment they were created would be worse.
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestAuth: GuestAuthService,
  ) {}

  async list(): Promise<GuestSummary[]> {
    const customers = await this.prisma.customer.findMany({
      include: {
        // Every booking they ever had, cancelled ones included. What separates
        // a guest the host typed in from the debris of an abandoned checkout
        // is this count being zero — a hold always writes a booking row.
        _count: { select: { bookings: true } },
        bookings: {
          where: {
            status: { not: 'CANCELLED' },
            NOT: { status: 'PENDING', expiresAt: { lt: new Date() } },
          },
          orderBy: { checkIn: 'asc' },
          include: {
            // A failed refund returned nothing, so it is not money that left.
            refunds: { where: { status: { not: 'FAILED' } }, select: { amount: true } },
          },
        },
      },
    })

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    return customers
      .filter((customer) => customer.bookings.length > 0 || customer._count.bookings === 0)
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
          firstName: customer.firstName,
          lastName: customer.lastName,
          name: `${customer.firstName} ${customer.lastName}`,
          email: customer.email,
          phone: customer.phone,
          country: customer.country,
          stays: customer.bookings.length,
          nights,
          totalSpent,
          firstStay: customer.bookings.length ? iso(customer.bookings[0].checkIn) : null,
          lastStay: customer.bookings.length
            ? iso(customer.bookings[customer.bookings.length - 1].checkIn)
            : null,
          upcoming: next
            ? {
                reference: next.reference,
                checkIn: iso(next.checkIn),
                checkOut: iso(next.checkOut),
              }
            : null,
          // Newest first: what someone opening a guest wants is the last time
          // they were here, not the first.
          stayHistory: [...customer.bookings].reverse().map((booking) => ({
            id: booking.id,
            reference: booking.reference,
            checkIn: iso(booking.checkIn),
            checkOut: iso(booking.checkOut),
            nights: Math.round(
              (booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000,
            ),
            guests: booking.adults + booking.children,
            total: Number(booking.totalPrice),
            status: booking.status,
            paidAt: booking.paidAt?.toISOString() ?? null,
            refunded: booking.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0),
          })),
          notes: customer.notes,
        }
      })
      .sort((a, b) => (b.lastStay ?? '').localeCompare(a.lastStay ?? ''))
  }

  async create(dto: CreateCustomerDto) {
    try {
      return await this.prisma.customer.create({ data: dto })
    } catch (error) {
      throw this.emailTaken(error)
    }
  }

  async update(id: string, dto: UpdateCustomerDto) {
    try {
      return await this.prisma.customer.update({ where: { id }, data: dto })
    } catch (error) {
      if ((error as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
        throw new NotFoundException('Guest not found')
      }
      throw this.emailTaken(error)
    }
  }

  /**
   * Removes a guest who never stayed.
   *
   * Anyone with a booking stays put: their row is what a stay is attached to,
   * and deleting it would leave a reservation with nobody's name on it. What
   * this is for is the rows an abandoned checkout leaves behind.
   */
  async remove(id: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { bookings: true } } },
    })
    if (!customer) throw new NotFoundException('Guest not found')

    if (customer._count.bookings > 0) {
      throw new ConflictException('This guest has bookings and cannot be deleted')
    }

    await this.prisma.customer.delete({ where: { id } })
  }

  /**
   * Re-sends the guest's sign-in link, at the host's request.
   *
   * Delegates to the same service the public endpoint uses, so there is one
   * way a link is ever made: same expiry, same single use, same invalidation
   * of whatever was outstanding. A second path would be a second thing to get
   * wrong.
   */
  async resendLoginLink(id: string, locale: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { bookings: true } } },
    })
    if (!customer) throw new NotFoundException('Guest not found')

    if (customer._count.bookings === 0) {
      throw new ConflictException('This guest has no bookings to sign in and see')
    }

    await this.guestAuth.requestLink(customer.email, locale)
  }

  /** Email is unique, and a duplicate is the one failure worth naming. */
  private emailTaken(error: unknown): unknown {
    if ((error as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
      return new ConflictException('Another guest already uses that email')
    }
    return error
  }
}
