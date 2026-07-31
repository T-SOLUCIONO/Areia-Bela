/**
 * The shell every email goes in.
 *
 * Tables and inline styles, not flexbox and a stylesheet: Outlook still runs a
 * Word rendering engine, and Gmail strips `<style>` blocks. This is the shape
 * that survives, and it is why email markup looks like 2003.
 *
 * The logo is an absolute URL rather than an attachment or a data URI —
 * attachments show up as paperclips on a message that has none, and Gmail
 * refuses data URIs in images outright.
 */

const INK = '#173a57'
const BLUE = '#174d7a'
const CREAM = '#f7f2ea'
const MUTED = '#6b7280'
const BORDER = '#e7e2d8'

export interface EmailBlock {
  /** A label above the value, like a form field. */
  label?: string
  value: string
}

export interface EmailLayout {
  siteUrl: string
  preheader: string
  heading: string
  intro: string
  /** The one thing the email is for. Rendered big, on cream. */
  highlight?: { label: string; value: string; note?: string }
  blocks?: EmailBlock[]
  cta?: { label: string; href: string }
  /** Small print under the button. */
  footnote?: string
  closing?: string
}

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function renderEmail(layout: EmailLayout): string {
  const {
    siteUrl,
    preheader,
    heading,
    intro,
    highlight,
    blocks = [],
    cta,
    footnote,
    closing,
  } = layout

  const blockRows = blocks
    .map(
      (block) => `
        <tr>
          <td style="padding:0 0 14px 0;">
            ${
              block.label
                ? `<div style="font:600 11px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};padding-bottom:3px;">${escape(block.label)}</div>`
                : ''
            }
            <div style="font:400 15px/1.5 Helvetica,Arial,sans-serif;color:${INK};">${escape(block.value).replace(/\n/g, '<br>')}</div>
          </td>
        </tr>`,
    )
    .join('')

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};">
<!-- The line inboxes show next to the subject. Hidden in the message itself. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(preheader)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">

        <tr>
          <td style="padding:28px 32px 0 32px;">
            <img src="${siteUrl}/areia-bela-logo.png" alt="Areia Bela" width="132" style="display:block;border:0;height:auto;">
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0 32px;">
            <h1 style="margin:0;font:400 26px/1.25 Georgia,'Times New Roman',serif;color:${INK};">${escape(heading)}</h1>
            <p style="margin:12px 0 0 0;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:${MUTED};">${escape(intro)}</p>
          </td>
        </tr>

        ${
          highlight
            ? `<tr>
          <td style="padding:24px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:12px;">
              <tr>
                <td style="padding:20px 24px;text-align:center;">
                  <div style="font:600 11px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${BLUE};">${escape(highlight.label)}</div>
                  <div style="font:700 28px/1.2 'Courier New',Courier,monospace;letter-spacing:2px;color:${INK};padding-top:6px;">${escape(highlight.value)}</div>
                  ${highlight.note ? `<div style="font:400 13px/1.5 Helvetica,Arial,sans-serif;color:${MUTED};padding-top:6px;">${escape(highlight.note)}</div>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>`
            : ''
        }

        ${
          blocks.length
            ? `<tr>
          <td style="padding:24px 32px 0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${blockRows}</table>
          </td>
        </tr>`
            : ''
        }

        ${
          cta
            ? `<tr>
          <td style="padding:24px 32px 0 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${BLUE};border-radius:999px;">
                  <a href="${cta.href}" style="display:inline-block;padding:13px 28px;font:600 15px/1 Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;">${escape(cta.label)}</a>
                </td>
              </tr>
            </table>
            ${footnote ? `<p style="margin:14px 0 0 0;font:400 13px/1.5 Helvetica,Arial,sans-serif;color:${MUTED};">${escape(footnote)}</p>` : ''}
          </td>
        </tr>`
            : ''
        }

        ${
          closing
            ? `<tr>
          <td style="padding:24px 32px 0 32px;">
            <p style="margin:0;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:${INK};">${escape(closing)}</p>
          </td>
        </tr>`
            : ''
        }

        <tr>
          <td style="padding:28px 32px 28px 32px;">
            <div style="border-top:1px solid ${BORDER};padding-top:16px;font:400 12px/1.6 Helvetica,Arial,sans-serif;color:${MUTED};">
              Areia Bela · St. Petersburg, Florida<br>
              <a href="${siteUrl}" style="color:${BLUE};text-decoration:none;">areiabela.com</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}
