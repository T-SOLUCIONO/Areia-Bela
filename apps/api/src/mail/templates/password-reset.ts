import { PASSWORD_RESET_TTL_MINUTES } from '@areia-bela/shared'
import type { OutgoingEmail } from '../mail.service'

/**
 * Plain inline styles, no external CSS or images: email clients strip most of
 * it anyway, and a remote asset would leak when the message is opened.
 */
export function passwordResetEmail(params: {
  to: string
  firstName: string
  resetUrl: string
  /** True when a superadmin triggered it, rather than the user themselves. */
  requestedByAdmin: boolean
}): OutgoingEmail {
  const { to, firstName, resetUrl, requestedByAdmin } = params

  const reason = requestedByAdmin
    ? 'An administrator asked us to send you a link to set a new password.'
    : 'We received a request to reset the password for your Areia Bela admin account.'

  const text = [
    `Hi ${firstName},`,
    '',
    reason,
    '',
    `Set a new password: ${resetUrl}`,
    '',
    `This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes and can only be used once.`,
    "If you weren't expecting this, you can ignore this email — your password stays the same.",
    '',
    'Areia Bela',
  ].join('\n')

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#173a57">
  <h1 style="font-size:20px;margin:0 0 24px">Reset your password</h1>
  <p style="margin:0 0 16px;line-height:1.6">Hi ${firstName},</p>
  <p style="margin:0 0 24px;line-height:1.6;color:#5d6b77">${reason}</p>
  <p style="margin:0 0 24px">
    <a href="${resetUrl}" style="display:inline-block;background:#174d7a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600">Set a new password</a>
  </p>
  <p style="margin:0 0 8px;line-height:1.6;color:#5d6b77;font-size:14px">
    This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes and can only be used once.
  </p>
  <p style="margin:0 0 24px;line-height:1.6;color:#5d6b77;font-size:14px">
    If you weren't expecting this, you can ignore this email — your password stays the same.
  </p>
  <p style="margin:0;color:#8a97a3;font-size:12px;word-break:break-all">
    If the button doesn't work, paste this into your browser:<br />${resetUrl}
  </p>
</div>`.trim()

  return { to, toName: firstName, subject: 'Reset your Areia Bela password', html, text }
}
