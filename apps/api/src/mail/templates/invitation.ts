import { INVITATION_TTL_HOURS } from '@areia-bela/shared'
import type { OutgoingEmail } from '../mail.service'

/**
 * Sent when a superadmin adds someone to the team. Carries a link, never a
 * password: the invitee sets their own, so no credential is ever written into
 * an inbox and the person who invited them never learns it.
 */
export function invitationEmail(params: {
  to: string
  firstName: string
  invitedByName: string
  acceptUrl: string
}): OutgoingEmail {
  const { to, firstName, invitedByName, acceptUrl } = params

  const text = [
    `Hi ${firstName},`,
    '',
    `${invitedByName} has given you access to the Areia Bela admin panel.`,
    '',
    `Choose your password to get started: ${acceptUrl}`,
    '',
    `This link expires in ${INVITATION_TTL_HOURS} hours and can only be used once.`,
    "If you weren't expecting this, you can ignore this email.",
    '',
    'Areia Bela',
  ].join('\n')

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#173a57">
  <h1 style="font-size:20px;margin:0 0 24px">You've been added to Areia Bela</h1>
  <p style="margin:0 0 16px;line-height:1.6">Hi ${firstName},</p>
  <p style="margin:0 0 24px;line-height:1.6;color:#5d6b77">
    ${invitedByName} has given you access to the Areia Bela admin panel.
  </p>
  <p style="margin:0 0 24px">
    <a href="${acceptUrl}" style="display:inline-block;background:#174d7a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600">Choose your password</a>
  </p>
  <p style="margin:0 0 8px;line-height:1.6;color:#5d6b77;font-size:14px">
    This link expires in ${INVITATION_TTL_HOURS} hours and can only be used once.
  </p>
  <p style="margin:0 0 24px;line-height:1.6;color:#5d6b77;font-size:14px">
    If you weren't expecting this, you can ignore this email.
  </p>
  <p style="margin:0;color:#8a97a3;font-size:12px;word-break:break-all">
    If the button doesn't work, paste this into your browser:<br />${acceptUrl}
  </p>
</div>`.trim()

  return { to, toName: firstName, subject: "You've been added to Areia Bela", html, text }
}
