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
      email: this.config.get<string>('EMAIL_FROM_ADDRESS') ?? 'no-reply@areiabela.com',
      name: this.config.get<string>('EMAIL_FROM_NAME') ?? 'Areia Bela',
    }
  }

  async send(email: OutgoingEmail): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(
        `BREVO_API_KEY not set — email NOT sent. To: ${email.to} | ${email.subject}\n${email.text}`,
      )
      return
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
      return
    }

    this.logger.log(`Email sent to ${email.to}: ${email.subject}`)
  }
}
