import { Logger } from '@nestjs/common'

/**
 * How the host is reached. Three implementations, chosen by what is configured,
 * so adding a fourth is a class rather than a rewrite.
 */
export interface NotificationChannel {
  readonly name: string
  /**
   * Whether the message actually left.
   *
   * A channel that cannot deliver returns `false` instead of pretending. It
   * used to return nothing, so `deliver` logged a confident "Sent" for every
   * attempt — including the ones that never sent anything.
   */
  send(to: string, subject: string, body: string): Promise<boolean>
}

// --- WhatsApp via Twilio -----------------------------------------------------

interface TwilioError {
  message?: string
}

/**
 * WhatsApp through Twilio.
 *
 * Twilio rather than Meta's Cloud API directly: Meta needs a verified Business
 * account and every business-initiated template approved before a single
 * message goes out, which is days of paperwork. Twilio's sandbox sends today,
 * and swapping later means replacing this class.
 *
 * The 24-hour rule still applies whoever the provider is: outside a window
 * opened by the recipient, only an approved template will deliver. For the
 * host's own number that is solved by replying once to the sandbox; for
 * messaging guests it would need templates, which is why nothing here writes
 * to a guest.
 */
export class WhatsAppChannel implements NotificationChannel {
  readonly name = 'WhatsApp'

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
  ) {}

  async send(to: string, subject: string, body: string): Promise<boolean> {
    const digits = to.replace(/\D/g, '')
    if (!digits) throw new Error('No WhatsApp number configured')

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          From: `whatsapp:${this.from.startsWith('+') ? this.from : `+${this.from}`}`,
          To: `whatsapp:+${digits}`,
          // WhatsApp has no subject line, so it becomes the first bold line.
          Body: `*${subject}*\n\n${body}`,
        }),
      },
    )

    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as TwilioError | null
      throw new Error(`Twilio: ${detail?.message ?? response.statusText}`)
    }
    return true
  }
}

// --- Telegram ----------------------------------------------------------------

interface TelegramError {
  description?: string
}

/**
 * Telegram, through the Bot API.
 *
 * Added because WhatsApp is the wrong tool for this particular job. Meta's
 * 24-hour rule means a business-initiated message only arrives if the recipient
 * wrote first or if the exact wording was approved as a template — and a booking
 * alert at three in the morning is business-initiated by definition. Twilio's
 * sandbox window expires and has to be reopened by hand.
 *
 * Telegram has no window, no templates and no approval, and it costs nothing. A
 * bot from @BotFather and the host's chat id is the whole setup. For reaching
 * *one known person* reliably, that is a better fit than a channel designed for
 * consumer marketing.
 *
 * The chat id is not a phone number. It comes from
 * `api.telegram.org/bot<TOKEN>/getUpdates` after the host says anything to the
 * bot once — which is also what authorises the bot to write to them, so there is
 * no way to message a stranger by guessing.
 */
export class TelegramChannel implements NotificationChannel {
  readonly name = 'Telegram'

  constructor(private readonly botToken: string) {}

  async send(to: string, subject: string, body: string): Promise<boolean> {
    const chatId = to.trim()
    if (!chatId) throw new Error('No Telegram chat id configured')

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        // Telegram has no subject line, so it becomes the first bold line — the
        // same shape the WhatsApp channel uses, for one recognisable format.
        text: `*${escapeMarkdown(subject)}*\n\n${escapeMarkdown(body)}`,
        parse_mode: 'MarkdownV2',
        // Alerts are read, not browsed: a map preview of the house under every
        // booking would push the numbers off the screen.
        link_preview_options: { is_disabled: true },
      }),
    })

    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as TelegramError | null
      throw new Error(`Telegram: ${detail?.description ?? response.statusText}`)
    }
    return true
  }
}

/**
 * Escapes what MarkdownV2 reserves.
 *
 * Telegram rejects the whole message — 400, nothing delivered — if a reserved
 * character appears unescaped. Guest names and cancellation reasons are free
 * text, so a guest called "J. Smith-Doe" or a note with a hyphen would silently
 * cost the host their alert.
 */
const escapeMarkdown = (text: string) => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&')

// --- Email -------------------------------------------------------------------

/** Wraps the existing mail service so both channels share one interface. */
export class EmailChannel implements NotificationChannel {
  readonly name = 'Email'

  constructor(
    private readonly mailer: {
      send(email: { to: string; subject: string; html: string; text: string }): Promise<boolean>
    },
  ) {}

  async send(to: string, subject: string, body: string): Promise<boolean> {
    return this.mailer.send({
      to,
      subject,
      text: body,
      // Plain and readable rather than a designed template: this is an alert
      // the host reads on a phone, not marketing.
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#173a57">
  <h2 style="font-size:17px;margin:0 0 12px">${escapeHtml(subject)}</h2>
  ${body
    .split('\n')
    .map((line) => `<p style="margin:0 0 6px">${escapeHtml(line) || '&nbsp;'}</p>`)
    .join('')}
</div>`,
    })
  }
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// --- Delivery ----------------------------------------------------------------

export interface Destination {
  channel: NotificationChannel
  to: string
}

/**
 * Sends to every configured destination, and never lets a failure escape.
 *
 * A booking that succeeded must not report an error because a notification
 * did not go out — the guest paid, the dates are held, and the host can still
 * see it in the panel. Failures are logged loudly instead.
 */
export async function deliver(
  destinations: Destination[],
  subject: string,
  body: string,
  logger: Logger,
): Promise<void> {
  await Promise.all(
    destinations.map(async ({ channel, to }) => {
      try {
        const sent = await channel.send(to, subject, body)
        if (sent) logger.log(`Sent "${subject}" over ${channel.name}`)
        // Not an error — the channel already said why, loudly — but not a
        // delivery either, and the log must not claim one.
        else logger.warn(`"${subject}" was not delivered over ${channel.name}`)
      } catch (error) {
        logger.error(
          `Could not send "${subject}" over ${channel.name}: ${(error as Error).message}`,
        )
      }
    }),
  )
}
