import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export interface OutgoingEmail {
  to: string
  toName?: string
  subject: string
  html: string
  text: string
}

/**
 * Transactional email via Brevo's HTTP API — chosen over SMTP because it needs
 * no extra dependency, just fetch.
 *
 * Without BREVO_API_KEY it falls back to logging the message, so the whole
 * reset flow can be exercised locally without credentials or a verified
 * domain. The fallback is loud on purpose: silently dropping a password-reset
 * email would look like the feature works when it doesn't.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string | undefined {
    return this.config.get<string>('BREVO_API_KEY')
  }

  private get sender(): { email: string; name: string } {
    return {
      // Brevo refuses a sender on an unverified domain, so a wrong value here
      // is silence rather than an error the caller sees.
      email: this.config.get<string>('EMAIL_FROM_ADDRESS') ?? 'no-reply@areiabela.com',
      name: this.config.get<string>('EMAIL_FROM_NAME') ?? 'Areia Bela',
    }
  }

  /**
   * Returns whether the message actually left, and that return value is the
   * point.
   *
   * This used to be `void`, so "no API key", "the provider said no" and "sent"
   * were indistinguishable to every caller. They all logged a confident
   * *"Sent confirmation to the guest"* — including, in production, one line
   * after this service had just warned that nothing was sent at all. Two log
   * entries in the same millisecond, one of them false.
   *
   * A log that claims work nobody did is worse than no log: it is the line
   * someone will trust while looking for why a guest never got their booking.
   *
   * It stays a boolean rather than a thrown error on purpose. Whether the
   * provider accepted a message must not change what an endpoint answers —
   * `/auth/forgot-password` replies the same either way, or it becomes a way
   * to find out which addresses have accounts.
   */
  async send(email: OutgoingEmail): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(
        `BREVO_API_KEY not set — email NOT sent. To: ${email.to} | ${email.subject}\n${email.text}`,
      )
      return false
    }

    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: this.sender,
        to: [{ email: email.to, ...(email.toName ? { name: email.toName } : {}) }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
      }),
    })

    if (!response.ok) {
      // Logged rather than thrown to the caller: whether the provider accepted
      // the message must not change what /auth/forgot-password answers, or the
      // endpoint becomes an account enumerator.
      this.logger.error(
        `Brevo rejected the email to ${email.to} (${response.status}): ${await response.text()}`,
      )
      return false
    }

    this.logger.log(`Email sent to ${email.to}: ${email.subject}`)
    return true
  }
}
