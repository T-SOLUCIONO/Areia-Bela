import { Injectable, NotFoundException } from '@nestjs/common'
import type { BookingStatus, CancellationPolicy } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateMyDetailsDto } from './dto/guest-auth.dto'

/** The bill as charged, read off the booking rather than recomputed. */
export interface BookingBill {
  nightsSubtotal: number
  weeklyDiscount: number
  extrasTotal: number
  additionalGuestFee: number
  cleaningFee: number
  serviceFee: number
  taxes: number
  total: number
}

export interface MyBooking {
  reference: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  adults: number
  children: number
  infants: number
  pets: number
  total: number
  bill: BookingBill
  status: BookingStatus
  extras: string[]
  specialRequests: string | null
  checkInTime: string
  checkOutTime: string
  /** Live only while a hold is unpaid; lets the guest finish paying. */
  checkoutUrl: string | null
  cancellationPolicy: CancellationPolicy
  /** What the host wants every guest to know. Empty until they write it. */
  accessNotes: string | null
  houseRules: string | null
  trashCollectionDays: string[]
  address: string
  /** Past stays are shown differently and cannot be acted on. */
  past: boolean
}

export interface MyDetails {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
}

const iso = (date: Date): string => date.toISOString().slice(0, 10)

/**
 * What a guest can see and change about themselves.
 *
 * Every query is scoped by `customerId` from the session — never by anything
 * in the request. A booking reference in a URL must not be enough to read
 * somebody else's stay.
 */
@Injectable()
export class GuestService {
  constructor(private readonly prisma: PrismaService) {}

  async myBookings(customerId: string): Promise<MyBooking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        customerId,
        // A hold that expired is not a booking the guest ever had. Showing it
        // would raise a question with no useful answer.
        NOT: { status: 'PENDING', expiresAt: { lt: new Date() } },
      },
      include: {
        extras: { include: { extra: true } },
        property: {
          select: {
            checkInTime: true,
            checkOutTime: true,
            cancellationPolicy: true,
            accessNotes: true,
            trashCollectionDays: true,
            address: true,
          },
        },
      },
      orderBy: { checkIn: 'desc' },
    })

    // The house rules the host wrote in the CMS, not a set invented here.
    // Null when they have not written any, and the UI omits the block.
    const rulesPage = await this.prisma.cMSPage.findFirst({
      where: { slug: 'HOUSE_RULES', published: true },
      select: { body: true },
    })
    const houseRules = rulesPage?.body?.trim() || null

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    return bookings.map((booking) => ({
      reference: booking.reference,
      checkIn: iso(booking.checkIn),
      checkOut: iso(booking.checkOut),
      nights: Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000),
      guests: booking.adults + booking.children,
      pets: booking.pets,
      adults: booking.adults,
      children: booking.children,
      infants: booking.infants,
      total: Number(booking.totalPrice),
      bill: {
        nightsSubtotal: Number(booking.nightsSubtotal),
        weeklyDiscount: Number(booking.weeklyDiscount),
        extrasTotal: Number(booking.extrasTotal),
        additionalGuestFee: Number(booking.additionalGuestFee),
        cleaningFee: Number(booking.cleaningFee),
        serviceFee: Number(booking.serviceFee),
        taxes: Number(booking.taxes),
        total: Number(booking.totalPrice),
      },
      status: booking.status,
      extras: booking.extras.map((line) => line.extra.name),
      specialRequests: booking.specialRequests,
      checkInTime: booking.property.checkInTime,
      checkOutTime: booking.property.checkOutTime,
      // Only while the hold is alive and unpaid. A confirmed booking has it
      // cleared, and an expired one never reaches this list.
      checkoutUrl: booking.status === 'PENDING' ? booking.checkoutUrl : null,
      cancellationPolicy: booking.property.cancellationPolicy,
      accessNotes: booking.property.accessNotes,
      houseRules,
      trashCollectionDays: booking.property.trashCollectionDays,
      address: booking.property.address,
      past: booking.checkOut < today,
    }))
  }

  async myDetails(customerId: string): Promise<MyDetails> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) throw new NotFoundException('Guest not found')

    return {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      country: customer.country,
    }
  }

  /**
   * Corrects their own details.
   *
   * Email is not editable here on purpose: it is the identifier their bookings
   * hang off and the address their sign-in link goes to, so changing it from
   * inside a session is a way to take over an account with a stolen cookie.
   * Changing it is a conversation with the host.
   */
  async updateMyDetails(customerId: string, dto: UpdateMyDetailsDto): Promise<MyDetails> {
    await this.prisma.customer.update({ where: { id: customerId }, data: dto })
    return this.myDetails(customerId)
  }

  /** One stay, for the PDF. Scoped by customer, like everything else here. */
  async myBooking(customerId: string, reference: string): Promise<MyBooking> {
    const bookings = await this.myBookings(customerId)
    const booking = bookings.find((row) => row.reference === reference)
    if (!booking) throw new NotFoundException('Booking not found')
    return booking
  }
}
