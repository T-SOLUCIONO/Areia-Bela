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

/** The guest's own copy. Their language, unlike the host alerts. */
export interface GuestConfirmation extends BookingNotice {
  locale: string
  checkInTime: string
  checkOutTime: string
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

  /**
   * Tells the guest their stay is booked.
   *
   * Separate from the host alerts and not switchable in the panel: a guest who
   * paid is owed a record of what they bought, and the confirmation page says
   * this was sent. Failure is logged, never thrown — the booking is already
   * paid for and confirmed.
   */
  async guestConfirmation(booking: GuestConfirmation): Promise<void> {
    const copy = GUEST_COPY[booking.locale] ?? GUEST_COPY.en
    const body = [
      copy.greeting(booking.guestName.split(' ')[0]),
      '',
      copy.reference(booking.reference),
      '',
      copy.dates(booking.checkIn, booking.checkInTime, booking.checkOut, booking.checkOutTime),
      copy.guests(booking.guests),
      copy.total(booking.total),
      '',
      copy.closing,
    ].join('\n')

    try {
      await this.mail.send({
        to: booking.guestEmail,
        toName: booking.guestName,
        subject: copy.subject(booking.reference),
        text: body,
        // Same words, wrapped so clients that refuse plain text still show it.
        // No template: a booking reference is not improved by a layout, and an
        // HTML mail that renders differently from its text part is a bug
        // waiting to happen.
        html: `<pre style="font:inherit;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
      })
      this.logger.log(`Sent booking ${booking.reference} confirmation to the guest`)
    } catch (error) {
      this.logger.error(
        `Could not confirm booking ${booking.reference} to the guest: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      )
    }
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

/**
 * The guest's confirmation, in the five languages the site speaks.
 *
 * Plain text on purpose: it has to survive every mail client, and a booking
 * reference is not improved by a template.
 */
const GUEST_COPY: Record<
  string,
  {
    subject: (reference: string) => string
    greeting: (name: string) => string
    reference: (reference: string) => string
    dates: (checkIn: string, checkInTime: string, checkOut: string, checkOutTime: string) => string
    guests: (count: number) => string
    total: (amount: number) => string
    closing: string
  }
> = {
  es: {
    subject: (reference) => `Tu reserva en Areia Bela · ${reference}`,
    greeting: (name) => `Hola ${name}, tu reserva está confirmada.`,
    reference: (reference) => `Referencia: ${reference}`,
    dates: (checkIn, checkInTime, checkOut, checkOutTime) =>
      `Llegada: ${checkIn} desde las ${checkInTime}\nSalida: ${checkOut} antes de las ${checkOutTime}`,
    guests: (count) => `Huéspedes: ${count}`,
    total: (amount) => `Total pagado: $${amount}`,
    closing:
      'Angélica te escribirá antes de tu llegada con el código de la puerta y cómo llegar. Si tienes cualquier duda, responde a este correo.',
  },
  en: {
    subject: (reference) => `Your booking at Areia Bela · ${reference}`,
    greeting: (name) => `Hi ${name}, your booking is confirmed.`,
    reference: (reference) => `Reference: ${reference}`,
    dates: (checkIn, checkInTime, checkOut, checkOutTime) =>
      `Check-in: ${checkIn} from ${checkInTime}\nCheck-out: ${checkOut} by ${checkOutTime}`,
    guests: (count) => `Guests: ${count}`,
    total: (amount) => `Total paid: $${amount}`,
    closing:
      'Angélica will write to you before your arrival with the door code and directions. Any questions, just reply to this email.',
  },
  pt: {
    subject: (reference) => `Sua reserva na Areia Bela · ${reference}`,
    greeting: (name) => `Olá ${name}, sua reserva está confirmada.`,
    reference: (reference) => `Referência: ${reference}`,
    dates: (checkIn, checkInTime, checkOut, checkOutTime) =>
      `Chegada: ${checkIn} a partir das ${checkInTime}\nSaída: ${checkOut} até as ${checkOutTime}`,
    guests: (count) => `Hóspedes: ${count}`,
    total: (amount) => `Total pago: $${amount}`,
    closing:
      'Angélica escreverá antes da sua chegada com o código da porta e como chegar. Qualquer dúvida, responda a este e-mail.',
  },
  fr: {
    subject: (reference) => `Votre réservation à Areia Bela · ${reference}`,
    greeting: (name) => `Bonjour ${name}, votre réservation est confirmée.`,
    reference: (reference) => `Référence : ${reference}`,
    dates: (checkIn, checkInTime, checkOut, checkOutTime) =>
      `Arrivée : ${checkIn} à partir de ${checkInTime}\nDépart : ${checkOut} avant ${checkOutTime}`,
    guests: (count) => `Voyageurs : ${count}`,
    total: (amount) => `Total payé : ${amount} $`,
    closing:
      'Angélica vous écrira avant votre arrivée avec le code de la porte et l’itinéraire. Pour toute question, répondez simplement à cet e-mail.',
  },
  de: {
    subject: (reference) => `Ihre Buchung in Areia Bela · ${reference}`,
    greeting: (name) => `Hallo ${name}, Ihre Buchung ist bestätigt.`,
    reference: (reference) => `Referenz: ${reference}`,
    dates: (checkIn, checkInTime, checkOut, checkOutTime) =>
      `Anreise: ${checkIn} ab ${checkInTime}\nAbreise: ${checkOut} bis ${checkOutTime}`,
    guests: (count) => `Gäste: ${count}`,
    total: (amount) => `Bezahlt insgesamt: $${amount}`,
    closing:
      'Angélica schreibt Ihnen vor der Anreise mit dem Türcode und der Wegbeschreibung. Bei Fragen antworten Sie einfach auf diese E-Mail.',
  },
}

/** Guest names and notes are user input, and this one goes into an HTML mail. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
