import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import {
  deliver,
  EmailChannel,
  WhatsAppChannel,
  type Destination,
  type NotificationChannel,
} from './notification-channels'

/** What the host can be told about, and which switch turns each one off. */
export type NotificationEvent = 'booking' | 'cancellation' | 'message'

const SWITCH: Record<NotificationEvent, 'notifyOnBooking' | 'notifyOnCancel' | 'notifyOnMessage'> =
  {
    booking: 'notifyOnBooking',
    cancellation: 'notifyOnCancel',
    message: 'notifyOnMessage',
  }

export interface BookingNotice {
  reference: string
  guestName: string
  guestEmail: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  total: number
  extras?: string[]
  note?: string
}

export interface MessageNotice {
  name: string
  email: string
  message: string
}

/**
 * Tells the host what happened: a booking came in, one was cancelled, someone
 * wrote.
 *
 * Where those land is editable in the panel, and separate from the public
 * contact details — the address a guest writes to is rarely the one the host
 * wants an alert at. An empty notification field falls back to the public one
 * so a host with a single address does not type it twice.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private get whatsapp(): NotificationChannel | null {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID')
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN')
    const from = this.config.get<string>('TWILIO_WHATSAPP_FROM')

    return sid && token && from ? new WhatsAppChannel(sid, token, from) : null
  }

  /** Every configured way to reach the host for this kind of event. */
  private async destinationsFor(event: NotificationEvent): Promise<Destination[]> {
    const settings = await this.prisma.siteSettings.findUnique({ where: { id: 'site' } })
    if (!settings || !settings[SWITCH[event]]) return []

    const destinations: Destination[] = []

    const email = settings.notifyEmail.trim() || settings.contactEmail.trim()
    if (email) destinations.push({ channel: new EmailChannel(this.mail), to: email })

    const number = settings.notifyWhatsapp.trim() || settings.whatsapp.trim()
    const whatsapp = this.whatsapp
    if (number && whatsapp) destinations.push({ channel: whatsapp, to: number })

    if (destinations.length === 0) {
      this.logger.warn(`Nothing configured to notify about a ${event}`)
    }

    return destinations
  }

  async bookingCreated(booking: BookingNotice): Promise<void> {
    const lines = [
      `${booking.guestName} · ${booking.guests} ${booking.guests === 1 ? 'huésped' : 'huéspedes'}`,
      `${booking.checkIn} → ${booking.checkOut} (${booking.nights} ${booking.nights === 1 ? 'noche' : 'noches'})`,
      `Total: $${booking.total}`,
      '',
      `Contacto: ${booking.guestEmail}`,
      `Referencia: ${booking.reference}`,
    ]
    if (booking.extras?.length) lines.splice(3, 0, `Extras: ${booking.extras.join(', ')}`)
    if (booking.note) lines.push('', `Nota del huésped: ${booking.note}`)

    await deliver(
      await this.destinationsFor('booking'),
      `Nueva reserva · ${booking.checkIn}`,
      lines.join('\n'),
      this.logger,
    )
  }

  async bookingCancelled(booking: BookingNotice, reason?: string): Promise<void> {
    const lines = [
      `${booking.guestName} canceló su reserva.`,
      `${booking.checkIn} → ${booking.checkOut} (${booking.nights} ${booking.nights === 1 ? 'noche' : 'noches'})`,
      `Referencia: ${booking.reference}`,
      '',
      'Esas fechas vuelven a estar libres en el calendario.',
    ]
    if (reason) lines.splice(1, 0, `Motivo: ${reason}`)

    await deliver(
      await this.destinationsFor('cancellation'),
      `Reserva cancelada · ${booking.checkIn}`,
      lines.join('\n'),
      this.logger,
    )
  }

  async messageReceived(notice: MessageNotice): Promise<void> {
    await deliver(
      await this.destinationsFor('message'),
      `Mensaje de ${notice.name}`,
      [`De: ${notice.name} <${notice.email}>`, '', notice.message].join('\n'),
      this.logger,
    )
  }

  /** Shown in the panel so the host knows what is actually switched on. */
  async status() {
    const settings = await this.prisma.siteSettings.findUnique({ where: { id: 'site' } })

    return {
      email: Boolean(settings?.notifyEmail.trim() || settings?.contactEmail.trim()),
      whatsapp: Boolean(
        (settings?.notifyWhatsapp.trim() || settings?.whatsapp.trim()) && this.whatsapp,
      ),
      whatsappConfigured: this.whatsapp !== null,
    }
  }
}
