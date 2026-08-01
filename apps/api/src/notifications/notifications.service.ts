import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { renderEmail } from '../mail/email-layout'
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

/** A refund that has actually left, for the guest's own record. */
export interface RefundNotice {
  reference: string
  guestName: string
  guestEmail: string
  locale: string
  amount: number
  /** What they paid, so the two figures can be compared without doing sums. */
  total: number
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
  /**
   * Where an alert goes.
   *
   * `force` skips the host's switch. Reserved for the ones that are not
   * information but a task — a payment taken for dates that are gone. Turning
   * off booking alerts is a choice about noise, not a waiver on being told
   * money needs refunding.
   */
  private async destinationsFor(
    event: NotificationEvent,
    { force = false }: { force?: boolean } = {},
  ): Promise<Destination[]> {
    const settings = await this.prisma.siteSettings.findUnique({ where: { id: 'site' } })
    if (!settings || (!force && !settings[SWITCH[event]])) return []

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

  /**
   * Tells the guest money is on its way back.
   *
   * Not switchable, for the same reason the booking confirmation is not: a
   * refund is a movement on their card, and a card movement without an
   * explanation is the kind of thing that becomes a dispute.
   *
   * Sent only once Stripe has accepted the refund. Announcing one that then
   * failed would be worse than saying nothing.
   */
  async refundIssued(notice: RefundNotice): Promise<void> {
    const copy = REFUND_COPY[notice.locale] ?? REFUND_COPY.en
    const body = [
      copy.greeting(notice.guestName.split(' ')[0]),
      '',
      copy.amount(notice.amount, notice.total),
      copy.reference(notice.reference),
      ...(notice.note ? ['', notice.note] : []),
      '',
      copy.timing,
      '',
      copy.closing,
    ].join('\n')

    try {
      await this.mail.send({
        to: notice.guestEmail,
        toName: notice.guestName,
        subject: copy.subject(notice.reference),
        text: body,
        html: `<pre style="font:inherit;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
      })
      this.logger.log(`Told the guest about the refund on ${notice.reference}`)
    } catch (error) {
      // The money has already moved. A mail that did not send is not a reason
      // to unwind it, and the panel shows the refund either way.
      this.logger.error(
        `Could not tell the guest about the refund on ${notice.reference}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      )
    }
  }

  /** The host's own copy: money left the account. */
  async refundSent(notice: RefundNotice): Promise<void> {
    await deliver(
      await this.destinationsFor('cancellation'),
      `Reembolso enviado · ${notice.reference}`,
      [
        `Se devolvieron $${notice.amount} a ${notice.guestName}.`,
        `Referencia: ${notice.reference}`,
        `Total de la reserva: $${notice.total}`,
        ...(notice.note ? ['', `Nota: ${notice.note}`] : []),
      ].join('\n'),
      this.logger,
    )
  }

  /**
   * A guest paid for dates that are no longer available.
   *
   * Only reachable when a webhook arrives so late that the hold expired and
   * someone else booked the week. It cannot be fixed automatically — the money
   * has to go back — so it is sent regardless of the notification switches:
   * this is not an update the host can choose not to receive.
   */
  async bookingConflict(booking: BookingNotice, sessionId: string): Promise<void> {
    await deliver(
      await this.destinationsFor('booking', { force: true }),
      `ACCIÓN REQUERIDA · pago sin fechas · ${booking.reference}`,
      [
        `${booking.guestName} pagó $${booking.total} por ${booking.checkIn} → ${booking.checkOut},`,
        'pero esas fechas ya están reservadas por otra persona.',
        '',
        'Hay que devolverle el dinero en Stripe y escribirle.',
        '',
        `Contacto: ${booking.guestEmail}`,
        `Referencia: ${booking.reference}`,
        `Pago en Stripe: ${sessionId}`,
      ].join('\n'),
      this.logger,
    )
  }

  /**
   * The payment never completed and the dates went back on sale.
   *
   * Worth sending, and not spam: this is someone who tried to buy and got
   * halfway. Saying nothing leaves them assuming they have a booking. It goes
   * out regardless of the host's switches for the same reason the conflict
   * alert does — it is addressed to the guest, not to her.
   */
  async paymentNotCompleted(booking: GuestConfirmation, retryUrl: string): Promise<void> {
    const copy = ABANDONED_COPY[booking.locale] ?? ABANDONED_COPY.en
    const base = this.config.get<string>('PUBLIC_SITE_URL') ?? 'http://localhost:3000'

    try {
      await this.mail.send({
        to: booking.guestEmail,
        toName: booking.guestName,
        subject: copy.subject,
        text: [
          copy.greeting(booking.guestName.split(' ')[0]),
          '',
          copy.body(booking.checkIn, booking.checkOut),
          '',
          retryUrl,
        ].join('\n'),
        html: renderEmail({
          siteUrl: base,
          preheader: copy.preheader,
          heading: copy.heading,
          intro: copy.greeting(booking.guestName.split(' ')[0]),
          blocks: [{ label: copy.dates, value: `${booking.checkIn} → ${booking.checkOut}` }],
          cta: { label: copy.cta, href: retryUrl },
          footnote: copy.footnote,
        }),
      })
      this.logger.log(`Told ${booking.guestEmail} their payment did not complete`)
    } catch (error) {
      this.logger.error(
        `Could not tell a guest their payment failed: ${
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
const REFUND_COPY: Record<
  string,
  {
    subject: (reference: string) => string
    greeting: (name: string) => string
    amount: (amount: number, total: number) => string
    reference: (reference: string) => string
    timing: string
    closing: string
  }
> = {
  es: {
    subject: (reference) => `Reembolso de tu reserva · ${reference}`,
    greeting: (name) => `Hola ${name}, tu reembolso está en camino.`,
    amount: (amount, total) => `Importe devuelto: $${amount} de los $${total} que pagaste.`,
    reference: (reference) => `Referencia: ${reference}`,
    timing:
      'El dinero vuelve al mismo método de pago que usaste. Suele tardar entre 5 y 10 días hábiles, según tu banco.',
    closing: 'Si algo no cuadra, responde a este correo.',
  },
  en: {
    subject: (reference) => `Refund for your booking · ${reference}`,
    greeting: (name) => `Hi ${name}, your refund is on its way.`,
    amount: (amount, total) => `Amount returned: $${amount} of the $${total} you paid.`,
    reference: (reference) => `Reference: ${reference}`,
    timing:
      'The money goes back to the payment method you used. It usually takes 5 to 10 business days, depending on your bank.',
    closing: 'If anything looks wrong, just reply to this email.',
  },
  pt: {
    subject: (reference) => `Reembolso da sua reserva · ${reference}`,
    greeting: (name) => `Olá ${name}, seu reembolso está a caminho.`,
    amount: (amount, total) => `Valor devolvido: $${amount} dos $${total} que você pagou.`,
    reference: (reference) => `Referência: ${reference}`,
    timing:
      'O dinheiro volta para o mesmo meio de pagamento que você usou. Costuma levar de 5 a 10 dias úteis, conforme o seu banco.',
    closing: 'Se algo não bater, responda a este e-mail.',
  },
  fr: {
    subject: (reference) => `Remboursement de votre réservation · ${reference}`,
    greeting: (name) => `Bonjour ${name}, votre remboursement est en route.`,
    amount: (amount, total) => `Montant remboursé : ${amount} $ sur les ${total} $ payés.`,
    reference: (reference) => `Référence : ${reference}`,
    timing:
      'L’argent revient sur le moyen de paiement utilisé. Cela prend en général 5 à 10 jours ouvrés, selon votre banque.',
    closing: 'Si quelque chose ne va pas, répondez à ce message.',
  },
  de: {
    subject: (reference) => `Rückerstattung Ihrer Buchung · ${reference}`,
    greeting: (name) => `Hallo ${name}, Ihre Rückerstattung ist unterwegs.`,
    amount: (amount, total) => `Erstatteter Betrag: $${amount} von den gezahlten $${total}.`,
    reference: (reference) => `Referenz: ${reference}`,
    timing:
      'Das Geld geht auf dasselbe Zahlungsmittel zurück. Je nach Bank dauert es 5 bis 10 Werktage.',
    closing: 'Falls etwas nicht stimmt, antworten Sie einfach auf diese E-Mail.',
  },
}

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

/**
 * The "your payment did not go through" email.
 *
 * Deliberately not apologetic and not alarming: nothing was charged, the dates
 * are simply free again. The one thing it has to do is make trying again easy.
 */
const ABANDONED_COPY: Record<
  string,
  {
    subject: string
    preheader: string
    heading: string
    greeting: (name: string) => string
    body: (checkIn: string, checkOut: string) => string
    dates: string
    cta: string
    footnote: string
  }
> = {
  es: {
    subject: 'Tu reserva no llegó a completarse · Areia Bela',
    preheader: 'No se te cobró nada. Las fechas siguen disponibles.',
    heading: 'El pago no se completó',
    greeting: (name) =>
      `Hola ${name}, no llegamos a recibir el pago, así que la casa no quedó reservada.`,
    body: (checkIn, checkOut) => `Las fechas ${checkIn} → ${checkOut} vuelven a estar disponibles.`,
    dates: 'Las fechas que elegiste',
    cta: 'Reservar esas fechas',
    footnote:
      'No se te cobró nada. Si el pago te falló y no sabes por qué, escríbenos y lo miramos.',
  },
  en: {
    subject: 'Your booking was not completed · Areia Bela',
    preheader: 'Nothing was charged. The dates are free again.',
    heading: 'The payment did not go through',
    greeting: (name) => `Hi ${name}, the payment never reached us, so the house was not booked.`,
    body: (checkIn, checkOut) => `${checkIn} → ${checkOut} is available again.`,
    dates: 'The dates you picked',
    cta: 'Book those dates',
    footnote: 'Nothing was charged. If the payment failed and you are not sure why, write to us.',
  },
  pt: {
    subject: 'A sua reserva não foi concluída · Areia Bela',
    preheader: 'Nada foi cobrado. As datas estão livres novamente.',
    heading: 'O pagamento não foi concluído',
    greeting: (name) =>
      `Olá ${name}, o pagamento não chegou até nós, então a casa não ficou reservada.`,
    body: (checkIn, checkOut) => `${checkIn} → ${checkOut} está disponível novamente.`,
    dates: 'As datas que você escolheu',
    cta: 'Reservar essas datas',
    footnote: 'Nada foi cobrado. Se o pagamento falhou e não sabe por quê, escreva para nós.',
  },
  fr: {
    subject: 'Votre réservation n’a pas abouti · Areia Bela',
    preheader: 'Rien n’a été débité. Les dates sont de nouveau libres.',
    heading: 'Le paiement n’a pas abouti',
    greeting: (name) =>
      `Bonjour ${name}, le paiement ne nous est pas parvenu, la maison n’a donc pas été réservée.`,
    body: (checkIn, checkOut) => `${checkIn} → ${checkOut} est de nouveau disponible.`,
    dates: 'Les dates choisies',
    cta: 'Réserver ces dates',
    footnote: 'Rien n’a été débité. Si le paiement a échoué sans raison claire, écrivez-nous.',
  },
  de: {
    subject: 'Ihre Buchung wurde nicht abgeschlossen · Areia Bela',
    preheader: 'Es wurde nichts abgebucht. Die Daten sind wieder frei.',
    heading: 'Die Zahlung kam nicht zustande',
    greeting: (name) =>
      `Hallo ${name}, die Zahlung hat uns nicht erreicht, das Haus wurde also nicht gebucht.`,
    body: (checkIn, checkOut) => `${checkIn} → ${checkOut} ist wieder verfügbar.`,
    dates: 'Ihre gewählten Daten',
    cta: 'Diese Daten buchen',
    footnote: 'Es wurde nichts abgebucht. Falls die Zahlung fehlschlug, schreiben Sie uns.',
  },
}
