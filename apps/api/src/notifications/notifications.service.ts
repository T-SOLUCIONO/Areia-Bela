import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { WhatsAppProvider } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { renderEmail } from '../mail/email-layout'
import {
  deliver,
  EmailChannel,
  MetaWhatsAppChannel,
  TelegramChannel,
  WhatsAppChannel,
  type Destination,
  type MetaTemplate,
  type NotificationAttachment,
  type MetaTemplateStatus,
  type NotificationChannel,
} from './notification-channels'

/** How long Meta's answer about its own token is trusted for. */
const META_CHECK_TTL_MS = 60_000

/** What the host can be told about, and which switch turns each one off. */
export type NotificationEvent = 'booking' | 'cancellation' | 'change' | 'message'

const SWITCH: Record<
  NotificationEvent,
  'notifyOnBooking' | 'notifyOnCancel' | 'notifyOnChange' | 'notifyOnMessage'
> = {
  booking: 'notifyOnBooking',
  cancellation: 'notifyOnCancel',
  change: 'notifyOnChange',
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

/** A stay that moved: what it was, what it is, and what that costs. */
export interface ChangeNotice {
  before: BookingNotice
  after: BookingNotice
  /** New total minus old. Positive means the guest owes more. */
  difference: number
  /** Whether there is money already taken, and therefore a balance to settle. */
  paid: boolean
  reason?: string
}

/** The guest's copy of a change. Their language, and their old dates. */
export interface GuestChange extends BookingNotice {
  locale: string
  checkInTime: string
  checkOutTime: string
  previousCheckIn: string
  previousCheckOut: string
  reason?: string
}

/** The guest's own copy. Their language, unlike the host alerts. */
export interface GuestConfirmation extends BookingNotice {
  locale: string
  checkInTime: string
  checkOutTime: string
}

/** The guest's copy of a cancellation. Their language, like the confirmation. */
export interface GuestCancellation extends BookingNotice {
  locale: string
  reason?: string
  /** Whether there is money to give back, which changes what the mail promises. */
  paid: boolean
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
  /** `reversal` comes back in days; anything else goes at the bank's pace. */
  settlesAs?: string
  /** The acquirer reference number, when Stripe has one to give. */
  cardReference?: string
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

  /**
   * A credential from the environment, without the whitespace around it.
   *
   * Trimmed because of how these actually get set. A secret written with
   * `--data-file=-` keeps the newline from the Enter that ended the paste, and a
   * token ending in `\n` builds an `Authorization` header that is rejected as
   * malformed — a failure that looks nothing like its cause. Same for a value
   * copied out of a console with a trailing space.
   *
   * Empty becomes `undefined`, so a variable that exists but holds only
   * whitespace counts as unset rather than putting a channel into a state where
   * it is configured and cannot possibly work.
   */
  private secret(key: string): string | undefined {
    return this.config.get<string>(key)?.trim() || undefined
  }

  /**
   * Telegram, if a bot token is configured.
   *
   * The token is an environment variable and the chat id a setting: one belongs
   * to the deployment and the other to whoever is on call, and the host can
   * change where alerts land without anyone touching the service.
   */
  private get telegram(): NotificationChannel | null {
    const token = this.secret('TELEGRAM_BOT_TOKEN')
    return token ? new TelegramChannel(token) : null
  }

  private get twilio(): NotificationChannel | null {
    const sid = this.secret('TWILIO_ACCOUNT_SID')
    const token = this.secret('TWILIO_AUTH_TOKEN')
    const from = this.secret('TWILIO_WHATSAPP_FROM')

    return sid && token && from ? new WhatsAppChannel(sid, token, from) : null
  }

  /**
   * The last answer Meta gave about its own token, and when.
   *
   * Cached because `status()` runs on every load of the settings screen and an
   * expiry is a thing that happens once a day, not once a request. Short enough
   * that renewing the token clears the warning while the host is still looking
   * at the page.
   */
  private metaCheck: {
    at: number
    problem: string | null
    templateStatus: MetaTemplateStatus | null
  } | null = null

  /**
   * The approved template alerts go out as, if there is one.
   *
   * Environment and not a setting: the name has to match a text Meta approved
   * for this specific WhatsApp account, so it belongs to the deployment. A host
   * typing it in the panel could only ever get it wrong.
   */
  private get metaTemplate(): MetaTemplate | null {
    const name = this.secret('META_WHATSAPP_TEMPLATE')
    const documentName = this.secret('META_WHATSAPP_DOCUMENT_TEMPLATE')
    // Either one is enough. They are approved separately, and requiring the text
    // template in order to use the document one would be a coupling nobody could
    // guess from the variable names.
    if (!name && !documentName) return null

    // Meta approves a template per language, and the host alerts are written in
    // Spanish, so that is the default rather than a guess to be configured.
    return {
      name,
      language: this.secret('META_WHATSAPP_TEMPLATE_LANGUAGE') ?? 'es',
      businessAccountId: this.secret('META_WHATSAPP_BUSINESS_ACCOUNT_ID'),
      documentName,
    }
  }

  private get meta(): MetaWhatsAppChannel | null {
    const token = this.secret('META_WHATSAPP_TOKEN')
    const phoneNumberId = this.secret('META_WHATSAPP_PHONE_NUMBER_ID')

    return token && phoneNumberId
      ? new MetaWhatsAppChannel(token, phoneNumberId, this.metaTemplate)
      : null
  }

  /**
   * The WhatsApp provider the host picked, and **only** that one.
   *
   * No silent substitution. Choosing Meta and getting Twilio because Meta was
   * not configured would mean the panel says one thing and the phone shows
   * another — and the host would have no reason to look. An unconfigured choice
   * is reported: the panel shows it per provider and the log says so.
   */
  private whatsappFor(provider: WhatsAppProvider): NotificationChannel | null {
    return provider === 'META' ? this.meta : this.twilio
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
    const whatsapp = this.whatsappFor(settings.whatsappProvider)
    if (number && whatsapp) destinations.push({ channel: whatsapp, to: number })
    else if (number && !whatsapp) {
      this.logger.warn(
        `WhatsApp is set to ${settings.whatsappProvider} and that provider has no credentials — no WhatsApp alert sent`,
      )
    }

    // No public fallback, unlike email and WhatsApp: a chat id is not something
    // a guest is ever given, so there is no second field to fall back to.
    // `?.` on purpose: the column is new. An API deployed against a database
    // that has not been migrated would read `undefined`, and a whole alert
    // would die on a `.trim()`. The pipeline migrates before deploying, but a
    // missing channel is a better failure than a lost notice.
    const chatId = settings.notifyTelegram?.trim() ?? ''
    const telegram = this.telegram
    if (chatId && telegram) destinations.push({ channel: telegram, to: chatId })

    if (destinations.length === 0) {
      this.logger.warn(`Nothing configured to notify about a ${event}`)
    }

    return destinations
  }

  /**
   * `attachment` is the booking PDF, and it is optional on purpose: an alert
   * without the file is worth far more than no alert, so a failure to render it
   * must not stop this. The caller decides, and swallows its own errors.
   */
  async bookingCreated(booking: BookingNotice, attachment?: NotificationAttachment): Promise<void> {
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
      attachment,
    )
  }

  async bookingCancelled(booking: BookingNotice, reason?: string): Promise<void> {
    const lines = [
      // Passive on purpose: this is sent from the panel, so the one cancelling
      // is the host. Saying the guest did it was simply wrong.
      `Se canceló la reserva de ${booking.guestName}.`,
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
      const sent = await this.mail.send({
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
      if (!sent) {
        // Says nothing was delivered, because nothing was. The reason is
        // already in MailService's own log, one line above this one.
        this.logger.warn(
          `Could not send booking ${booking.reference} confirmation — mail was not delivered`,
        )
        return
      }
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
   * Tells the host a stay moved, and what it left owing.
   *
   * The difference is spelled out in words rather than left as a signed number:
   * "the guest owes 180 more" and "180 is due back" are different jobs, and a
   * `-180` at the end of a line is the kind of thing that gets read backwards at
   * seven in the morning.
   */
  async bookingChanged(notice: ChangeNotice): Promise<void> {
    const { before, after, difference } = notice
    const moved = before.checkIn !== after.checkIn || before.checkOut !== after.checkOut

    const lines = [`Cambió la reserva de ${after.guestName}.`, `Referencia: ${after.reference}`, '']
    if (notice.reason) lines.push(`Motivo: ${notice.reason}`, '')
    if (moved) {
      lines.push(`Antes: ${before.checkIn} → ${before.checkOut} (${before.nights} noches)`)
      lines.push(`Ahora: ${after.checkIn} → ${after.checkOut} (${after.nights} noches)`)
    }
    if (before.guests !== after.guests) {
      lines.push(`Huéspedes: ${before.guests} → ${after.guests}`)
    }
    lines.push('', `Total: ${before.total} → ${after.total}`)

    if (difference === 0) {
      lines.push('El precio no cambia.')
    } else if (!notice.paid) {
      // Nothing has been taken yet, so there is nothing to settle: the guest
      // pays whatever the stay now costs.
      lines.push(`La reserva aún no está pagada, así que se cobrará ${after.total}.`)
    } else if (difference > 0) {
      lines.push(`El huésped debe ${difference} más. Hay que cobrarlo aparte.`)
    } else {
      lines.push(`Hay que devolver ${Math.abs(difference)}. Usa el reembolso del panel.`)
    }

    await deliver(
      await this.destinationsFor('change'),
      `Reserva modificada · ${after.reference}`,
      lines.join('\n'),
      this.logger,
    )
  }

  /**
   * Tells the guest their stay moved.
   *
   * Always sent and not switchable, like the confirmation: someone whose dates
   * changed needs to know before they turn up. It repeats the old dates on
   * purpose — a message with only the new ones reads like a booking they do not
   * remember making.
   *
   * It states the new total and says nothing about settling it. What the guest
   * owes or is owed is arranged by the host, and a mail promising a refund the
   * system has not issued would be a promise nobody made.
   */
  async guestChange(notice: GuestChange): Promise<void> {
    const copy = GUEST_CHANGE_COPY[notice.locale] ?? GUEST_CHANGE_COPY.en
    const body = [
      copy.greeting(notice.guestName.split(' ')[0]),
      '',
      copy.reference(notice.reference),
      '',
      copy.was(notice.previousCheckIn, notice.previousCheckOut),
      copy.now(notice.checkIn, notice.checkInTime, notice.checkOut, notice.checkOutTime),
      copy.guests(notice.guests),
      copy.total(notice.total),
      ...(notice.reason ? ['', copy.reason(notice.reason)] : []),
      '',
      copy.closing,
    ].join('\n')

    const sent = await this.mail.send({
      to: notice.guestEmail,
      toName: notice.guestName,
      subject: copy.subject(notice.reference),
      text: body,
      html: `<pre style="font:inherit;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
    })
    if (!sent) {
      this.logger.warn(`Could not send the change notice for ${notice.reference} — not delivered`)
      return
    }
    this.logger.log(`Told the guest booking ${notice.reference} changed`)
  }

  /**
   * Tells the guest their stay is off.
   *
   * This did not exist: cancelling from the panel freed the nights, alerted the
   * host and told the guest nothing at all. Someone would find out when they
   * turned up.
   *
   * Not switchable, like the confirmation: the panel's notification toggles are
   * about how much noise the host wants, not about whether a guest is told
   * their holiday is cancelled.
   */
  async guestCancellation(notice: GuestCancellation): Promise<void> {
    const copy = CANCEL_COPY[notice.locale] ?? CANCEL_COPY.en
    const body = [
      copy.greeting(notice.guestName.split(' ')[0]),
      '',
      copy.dates(notice.checkIn, notice.checkOut),
      copy.reference(notice.reference),
      ...(notice.reason ? ['', copy.reason(notice.reason)] : []),
      '',
      // Only promised when there is something to give back. A guest who never
      // paid does not need to be told a refund is coming.
      notice.paid ? copy.refundComing : copy.noPayment,
      '',
      copy.closing,
    ].join('\n')

    try {
      const sent = await this.mail.send({
        to: notice.guestEmail,
        toName: notice.guestName,
        subject: copy.subject(notice.reference),
        text: body,
        html: `<pre style="font:inherit;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
      })
      if (!sent) {
        // Says nothing was delivered, because nothing was. The reason is
        // already in MailService's own log, one line above this one.
        this.logger.warn(
          `Could not send the cancellation of ${notice.reference} — mail was not delivered`,
        )
        return
      }
      this.logger.log(`Told the guest booking ${notice.reference} was cancelled`)
    } catch (error) {
      this.logger.error(
        `Could not tell the guest about cancelling ${notice.reference}: ${
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
      notice.settlesAs === 'reversal' ? copy.timingReversal : copy.timingRefund,
      // Only when Stripe actually handed one over. A trace number the bank
      // cannot look up yet is worse than none.
      ...(notice.cardReference ? ['', copy.arn(notice.cardReference)] : []),
      '',
      copy.closing,
    ].join('\n')

    try {
      const sent = await this.mail.send({
        to: notice.guestEmail,
        toName: notice.guestName,
        subject: copy.subject(notice.reference),
        text: body,
        html: `<pre style="font:inherit;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
      })
      if (!sent) {
        // Says nothing was delivered, because nothing was. The reason is
        // already in MailService's own log, one line above this one.
        this.logger.warn(
          `Could not send the refund notice for ${notice.reference} — mail was not delivered`,
        )
        return
      }
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
      const sent = await this.mail.send({
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
      if (!sent) {
        // Says nothing was delivered, because nothing was. The reason is
        // already in MailService's own log, one line above this one.
        this.logger.warn(
          `Could not send the failed-payment notice for ${booking.reference} — mail was not delivered`,
        )
        return
      }
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
  /**
   * Why Meta would refuse to send, if it would.
   *
   * Meta is the only provider here whose credential dies on its own: the
   * dashboard's token lasts a day. Presence of the variable proved nothing, so
   * the panel used to show a configured WhatsApp while every alert failed and
   * only the log knew. Twilio and Telegram are not checked — their credentials
   * do not expire, so a live call per page load would buy nothing.
   */
  private async metaHealth(): Promise<{
    problem: string | null
    templateStatus: MetaTemplateStatus | null
  }> {
    const meta = this.meta
    if (!meta) return { problem: null, templateStatus: null }

    const cached = this.metaCheck
    if (cached && Date.now() - cached.at < META_CHECK_TTL_MS) return cached

    // Both questions in one round trip's worth of latency, and cached together:
    // they are asked by the same screen and they go stale for the same reason.
    const [problem, templateStatus] = await Promise.all([meta.verify(), meta.verifyTemplate()])
    this.metaCheck = { at: Date.now(), problem, templateStatus }
    return { problem, templateStatus }
  }

  async status() {
    const [settings, metaHealth] = await Promise.all([
      this.prisma.siteSettings.findUnique({ where: { id: 'site' } }),
      this.metaHealth(),
    ])

    return {
      email: Boolean(settings?.notifyEmail.trim() || settings?.contactEmail.trim()),
      whatsapp: Boolean(
        (settings?.notifyWhatsapp.trim() || settings?.whatsapp.trim()) &&
        settings &&
        this.whatsappFor(settings.whatsappProvider),
      ),
      whatsappProvider: settings?.whatsappProvider ?? 'TWILIO',
      // Whether the **chosen** provider can send.
      whatsappConfigured: Boolean(settings && this.whatsappFor(settings.whatsappProvider)),
      // And each one on its own, so the panel can say which is ready to switch
      // to instead of only that the current one is broken.
      twilioConfigured: this.twilio !== null,
      metaConfigured: this.meta !== null,
      // Not "is there a token" but "does Meta still accept it". Meta's own
      // sentence, in English, for the panel to show under a translated label.
      metaProblem: metaHealth.problem,
      // Without a template, an alert only arrives if the host happened to write
      // in the last 24 hours — which for a booking at 3am is never. The panel
      // has to say that, because the failure looks like nothing at all.
      metaTemplate: this.metaTemplate?.name !== undefined,
      // Meta's own word on the configured template, or `MISSING` when the name
      // is not in the account at all. A name Meta does not recognise fails every
      // send, unlike no name, which falls back to text — so the panel says which.
      metaTemplateStatus: metaHealth.templateStatus,
      // Two separate facts, deliberately: "there is a chat id" and "the service
      // has a bot token". A host who filled in the id needs to know the missing
      // half is not theirs to fix.
      telegram: Boolean(settings?.notifyTelegram?.trim() && this.telegram),
      telegramConfigured: this.telegram !== null,
    }
  }
}

/**
 * The guest's confirmation, in the five languages the site speaks.
 *
 * Plain text on purpose: it has to survive every mail client, and a booking
 * reference is not improved by a template.
 */
const CANCEL_COPY: Record<
  string,
  {
    subject: (reference: string) => string
    greeting: (name: string) => string
    dates: (checkIn: string, checkOut: string) => string
    reference: (reference: string) => string
    reason: (reason: string) => string
    refundComing: string
    noPayment: string
    closing: string
  }
> = {
  es: {
    subject: (reference) => `Tu reserva en Areia Bela se canceló · ${reference}`,
    greeting: (name) => `Hola ${name}, tu reserva quedó cancelada.`,
    dates: (checkIn, checkOut) => `Fechas: ${checkIn} → ${checkOut}`,
    reference: (reference) => `Referencia: ${reference}`,
    reason: (reason) => `Motivo: ${reason}`,
    refundComing:
      'Si pagaste, el reembolso se gestiona ahora y te llega un correo aparte con el importe exacto y el plazo.',
    noPayment: 'No se te cobró nada por esta reserva.',
    closing: 'Si esto no es lo que esperabas, responde a este correo y lo vemos.',
  },
  en: {
    subject: (reference) => `Your booking at Areia Bela was cancelled · ${reference}`,
    greeting: (name) => `Hi ${name}, your booking has been cancelled.`,
    dates: (checkIn, checkOut) => `Dates: ${checkIn} → ${checkOut}`,
    reference: (reference) => `Reference: ${reference}`,
    reason: (reason) => `Reason: ${reason}`,
    refundComing:
      'If you paid, the refund is being handled now and a separate email will tell you the exact amount and how long it takes.',
    noPayment: 'You were not charged for this booking.',
    closing: 'If this is not what you expected, reply to this email and we will sort it out.',
  },
  pt: {
    subject: (reference) => `Sua reserva na Areia Bela foi cancelada · ${reference}`,
    greeting: (name) => `Olá ${name}, sua reserva foi cancelada.`,
    dates: (checkIn, checkOut) => `Datas: ${checkIn} → ${checkOut}`,
    reference: (reference) => `Referência: ${reference}`,
    reason: (reason) => `Motivo: ${reason}`,
    refundComing:
      'Se você pagou, o reembolso está sendo processado e um e-mail à parte informará o valor exato e o prazo.',
    noPayment: 'Nada foi cobrado por esta reserva.',
    closing: 'Se não era isso que você esperava, responda a este e-mail e resolvemos.',
  },
  fr: {
    subject: (reference) => `Votre réservation à Areia Bela est annulée · ${reference}`,
    greeting: (name) => `Bonjour ${name}, votre réservation a été annulée.`,
    dates: (checkIn, checkOut) => `Dates : ${checkIn} → ${checkOut}`,
    reference: (reference) => `Référence : ${reference}`,
    reason: (reason) => `Motif : ${reason}`,
    refundComing:
      'Si vous avez payé, le remboursement est en cours et un message séparé vous indiquera le montant exact et le délai.',
    noPayment: 'Rien ne vous a été facturé pour cette réservation.',
    closing: 'Si ce n’est pas ce que vous attendiez, répondez à ce message.',
  },
  de: {
    subject: (reference) => `Ihre Buchung in Areia Bela wurde storniert · ${reference}`,
    greeting: (name) => `Hallo ${name}, Ihre Buchung wurde storniert.`,
    dates: (checkIn, checkOut) => `Daten: ${checkIn} → ${checkOut}`,
    reference: (reference) => `Referenz: ${reference}`,
    reason: (reason) => `Grund: ${reason}`,
    refundComing:
      'Falls Sie bezahlt haben, wird die Rückerstattung jetzt bearbeitet; eine separate E-Mail nennt den genauen Betrag und die Dauer.',
    noPayment: 'Für diese Buchung wurde Ihnen nichts berechnet.',
    closing: 'Wenn das nicht Ihren Erwartungen entspricht, antworten Sie einfach auf diese E-Mail.',
  },
}

const REFUND_COPY: Record<
  string,
  {
    subject: (reference: string) => string
    greeting: (name: string) => string
    amount: (amount: number, total: number) => string
    reference: (reference: string) => string
    /**
     * Two different waits, and Stripe knows which one applies. A charge that
     * had not settled yet is reversed and comes back in days; one that had is
     * a real refund and goes at the bank's pace.
     */
    timingReversal: string
    timingRefund: string
    arn: (reference: string) => string
    closing: string
  }
> = {
  es: {
    subject: (reference) => `Reembolso de tu reserva · ${reference}`,
    greeting: (name) => `Hola ${name}, tu reembolso está en camino.`,
    amount: (amount, total) => `Importe devuelto: $${amount} de los $${total} que pagaste.`,
    reference: (reference) => `Referencia: ${reference}`,
    timingReversal:
      'Como el cargo todavía no se había liquidado, se anula directamente: suele desaparecer de tu extracto en 1 a 3 días hábiles.',
    timingRefund:
      'El dinero vuelve al mismo método de pago que usaste. Suele tardar entre 5 y 10 días hábiles, y ese plazo lo pone tu banco, no nosotros.',
    arn: (reference) => `Si tu banco no lo encuentra, dale este número de rastreo: ${reference}`,
    closing: 'Si algo no cuadra, responde a este correo.',
  },
  en: {
    subject: (reference) => `Refund for your booking · ${reference}`,
    greeting: (name) => `Hi ${name}, your refund is on its way.`,
    amount: (amount, total) => `Amount returned: $${amount} of the $${total} you paid.`,
    reference: (reference) => `Reference: ${reference}`,
    timingReversal:
      'The charge had not settled yet, so it is being reversed outright: it usually drops off your statement in 1 to 3 business days.',
    timingRefund:
      'The money goes back to the payment method you used. It usually takes 5 to 10 business days, and that window is set by your bank, not by us.',
    arn: (reference) => `If your bank cannot find it, give them this trace number: ${reference}`,
    closing: 'If anything looks wrong, just reply to this email.',
  },
  pt: {
    subject: (reference) => `Reembolso da sua reserva · ${reference}`,
    greeting: (name) => `Olá ${name}, seu reembolso está a caminho.`,
    amount: (amount, total) => `Valor devolvido: $${amount} dos $${total} que você pagou.`,
    reference: (reference) => `Referência: ${reference}`,
    timingReversal:
      'Como a cobrança ainda não havia sido liquidada, ela é anulada direto: costuma sumir do seu extrato em 1 a 3 dias úteis.',
    timingRefund:
      'O dinheiro volta para o mesmo meio de pagamento que você usou. Costuma levar de 5 a 10 dias úteis, e esse prazo é do seu banco, não nosso.',
    arn: (reference) => `Se o seu banco não encontrar, passe este número de rastreio: ${reference}`,
    closing: 'Se algo não bater, responda a este e-mail.',
  },
  fr: {
    subject: (reference) => `Remboursement de votre réservation · ${reference}`,
    greeting: (name) => `Bonjour ${name}, votre remboursement est en route.`,
    amount: (amount, total) => `Montant remboursé : ${amount} $ sur les ${total} $ payés.`,
    reference: (reference) => `Référence : ${reference}`,
    timingReversal:
      'Le paiement n’était pas encore réglé, il est donc annulé directement : il disparaît en général de votre relevé sous 1 à 3 jours ouvrés.',
    timingRefund:
      'L’argent revient sur le moyen de paiement utilisé. Cela prend en général 5 à 10 jours ouvrés, un délai fixé par votre banque et non par nous.',
    arn: (reference) =>
      `Si votre banque ne le trouve pas, donnez-lui ce numéro de suivi : ${reference}`,
    closing: 'Si quelque chose ne va pas, répondez à ce message.',
  },
  de: {
    subject: (reference) => `Rückerstattung Ihrer Buchung · ${reference}`,
    greeting: (name) => `Hallo ${name}, Ihre Rückerstattung ist unterwegs.`,
    amount: (amount, total) => `Erstatteter Betrag: $${amount} von den gezahlten $${total}.`,
    reference: (reference) => `Referenz: ${reference}`,
    timingReversal:
      'Die Abbuchung war noch nicht abgerechnet und wird direkt storniert: Sie verschwindet meist innerhalb von 1 bis 3 Werktagen von Ihrem Kontoauszug.',
    timingRefund:
      'Das Geld geht auf dasselbe Zahlungsmittel zurück. Das dauert in der Regel 5 bis 10 Werktage — diese Frist setzt Ihre Bank, nicht wir.',
    arn: (reference) =>
      `Falls Ihre Bank sie nicht findet, geben Sie diese Referenznummer an: ${reference}`,
    closing: 'Falls etwas nicht stimmt, antworten Sie einfach auf diese E-Mail.',
  },
}

/**
 * The change notice, in the guest's language.
 *
 * Bilingual because the product is: a Spanish-speaking guest told in English
 * that their dates moved is a guest who phones to ask what happened. Only the
 * two languages the booking flow itself writes in — the rest of the site is
 * translated, the transactional mail is not, and that gap is declared rather
 * than papered over with a machine translation of a date change.
 */
const GUEST_CHANGE_COPY: Record<
  string,
  {
    subject: (reference: string) => string
    greeting: (name: string) => string
    reference: (reference: string) => string
    was: (checkIn: string, checkOut: string) => string
    now: (checkIn: string, checkInTime: string, checkOut: string, checkOutTime: string) => string
    guests: (count: number) => string
    total: (amount: number) => string
    reason: (reason: string) => string
    closing: string
  }
> = {
  es: {
    subject: (reference) => `Cambiamos las fechas de tu reserva · ${reference}`,
    greeting: (name) => `Hola ${name}, hemos actualizado tu reserva.`,
    reference: (reference) => `Referencia: ${reference}`,
    was: (checkIn, checkOut) => `Antes: ${checkIn} → ${checkOut}`,
    now: (checkIn, checkInTime, checkOut, checkOutTime) =>
      `Ahora: llegada el ${checkIn} desde las ${checkInTime}\n       salida el ${checkOut} antes de las ${checkOutTime}`,
    guests: (count) => `Huéspedes: ${count}`,
    total: (amount) => `Nuevo total: $${amount}`,
    reason: (reason) => `Motivo: ${reason}`,
    closing:
      'Si algo de esto no coincide con lo que acordamos, responde a este correo y lo revisamos.',
  },
  en: {
    subject: (reference) => `We updated your booking · ${reference}`,
    greeting: (name) => `Hi ${name}, your booking has been updated.`,
    reference: (reference) => `Reference: ${reference}`,
    was: (checkIn, checkOut) => `Before: ${checkIn} → ${checkOut}`,
    now: (checkIn, checkInTime, checkOut, checkOutTime) =>
      `Now: arriving ${checkIn} from ${checkInTime}\n     leaving ${checkOut} before ${checkOutTime}`,
    guests: (count) => `Guests: ${count}`,
    total: (amount) => `New total: $${amount}`,
    reason: (reason) => `Reason: ${reason}`,
    closing: "If any of this does not match what we agreed, reply to this email and we'll sort it.",
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
