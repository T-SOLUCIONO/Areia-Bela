import { Logger } from '@nestjs/common'

/**
 * How the host is reached. Four implementations, chosen by what is configured,
 * so adding a fifth is a class rather than a rewrite.
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

// --- WhatsApp via Meta's Cloud API ------------------------------------------

interface MetaError {
  error?: { message?: string; code?: number }
}

/**
 * WhatsApp straight from Meta, without a reseller in between.
 *
 * The other WhatsApp channel goes through Twilio. Both end at the same place,
 * and the difference is worth stating plainly:
 *
 * - **Twilio** has a sandbox that sends today, at the cost of a per-message
 *   markup and one more company holding the conversation.
 * - **Meta** is the official path: no markup, and the sender is your own
 *   number rather than a shared one. Getting there needs a Business account, a
 *   verified number and a permanent access token.
 *
 * What it does **not** change is the 24-hour rule. That is Meta's, not Twilio's,
 * so switching provider does not escape it — outside a window the recipient
 * opened, only an approved template arrives. Anyone choosing this expecting the
 * window to go away is choosing it for the wrong reason, which is why the panel
 * says so next to the choice.
 */
/** The approved template an alert goes out as, and the language it was approved in. */
export interface MetaTemplate {
  name: string
  language: string
}

/**
 * Meta's limit on a single body parameter. Longer is rejected outright, so a
 * long guest note must be cut rather than lose the whole alert.
 */
const META_PARAMETER_LIMIT = 1024

/**
 * Flattens an alert body into something a template parameter will accept.
 *
 * Meta rejects a parameter containing a newline, a tab, or more than four
 * consecutive spaces — the whole message, not the offending character. Every
 * alert here is built as multiple lines, which is exactly the shape that is not
 * allowed, so the lines are joined with a separator that reads as a break.
 *
 * The template itself is free to have all the newlines it wants. That is the
 * asymmetry worth remembering: the layout lives in the approved text, the data
 * arrives on one line.
 */
export function asTemplateParameter(text: string): string {
  const flat = text
    .split(/\n+/)
    // Every run of whitespace becomes one space, not just runs of two or more:
    // a lone tab is refused as firmly as a newline is.
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ')

  return flat.length > META_PARAMETER_LIMIT
    ? `${flat.slice(0, META_PARAMETER_LIMIT - 1).trimEnd()}…`
    : flat
}

export class MetaWhatsAppChannel implements NotificationChannel {
  readonly name = 'WhatsApp (Meta)'

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
    /**
     * Absent means free text, which only arrives inside a window the recipient
     * opened. Present means every alert goes out as the approved template and
     * therefore arrives at three in the morning too.
     */
    private readonly template: MetaTemplate | null = null,
  ) {}

  async send(to: string, subject: string, body: string): Promise<boolean> {
    const digits = to.replace(/\D/g, '')
    if (!digits) throw new Error('No WhatsApp number configured')

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: digits,
          ...this.content(subject, body),
        }),
      },
    )

    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as MetaError | null
      throw new Error(`Meta: ${detail?.error?.message ?? response.statusText}`)
    }
    return true
  }

  /**
   * Template when one is approved, plain text when not.
   *
   * Two parameters and not one per fact, deliberately. Every extra `{{n}}` is a
   * number that has to match between this code and a text sitting in Meta's
   * review queue, and a mismatch fails the send with nothing useful in the log.
   * A title and a one-line summary carry all four alerts — booking,
   * cancellation, change, message — through a single approval.
   */
  private content(subject: string, body: string) {
    if (!this.template) {
      // Same shape as the Twilio channel: one recognisable format for the host,
      // whichever provider woke them up.
      return { type: 'text', text: { preview_url: false, body: `*${subject}*\n\n${body}` } }
    }

    return {
      type: 'template',
      template: {
        name: this.template.name,
        language: { code: this.template.language },
        components: [
          {
            type: 'body',
            parameters: [subject, body].map((value) => ({
              type: 'text',
              text: asTemplateParameter(value),
            })),
          },
        ],
      },
    }
  }

  /**
   * Whether Meta will still accept this token, asked of Meta rather than
   * assumed.
   *
   * Meta is the only one of the three whose credential expires on its own. The
   * token the App Dashboard hands out lasts twenty-four hours, so a deployment
   * that worked on Monday is rejected on Tuesday with nothing having changed —
   * and the only trace is a line in the log that nobody is watching. The panel
   * cannot report "configured" from the presence of an environment variable
   * when the variable can be present and dead at the same time.
   *
   * Returns Meta's own words on failure, because "expired on 6 August" tells
   * the host what to do and "not working" does not. The panel labels it with
   * translated copy and shows the sentence as its own line — Meta writes in
   * English whatever the panel's language, and gluing a Spanish prefix onto it
   * would produce half a sentence in each.
   *
   * `null` also covers not having been able to *ask*. A DNS hiccup is not
   * evidence against the token, and a warning that appears when the network
   * blinks is a warning the host learns to ignore.
   */
  async verify(): Promise<string | null> {
    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/${this.phoneNumberId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })
      if (response.ok) return null
      const detail = (await response.json().catch(() => null)) as MetaError | null
      return detail?.error?.message ?? response.statusText
    } catch {
      return null
    }
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
