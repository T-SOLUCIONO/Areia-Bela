/**
 * How long a hold keeps the dates while the guest pays.
 *
 * Stripe refuses a checkout session that expires sooner than 30 minutes, so
 * this is the floor, not a preference: a hold shorter than the payment window
 * would free the dates while the guest is still on Stripe's page.
 */
export const HOLD_TTL_MINUTES = 30

/**
 * Reference alphabet.
 *
 * References get dictated over the phone, so the letters that sound or look
 * like a digit are gone: I, O and S. Their digits stay — with no S in the
 * alphabet, a 5 can only be a 5 — except 0 and 1, which survive bad
 * handwriting no better than the letters did.
 */
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ23456789'
const REFERENCE_LENGTH = 6

/**
 * A booking reference a guest can dictate over the phone.
 *
 * Not a cuid: those are 25 characters of case-sensitive noise. Uniqueness is
 * enforced by the database, and the caller retries on collision — with 31^6
 * (~887 million) combinations against a single house's bookings, that retry
 * is a formality rather than a real path.
 */
export function generateReference(random: () => number = Math.random): string {
  let reference = ''
  for (let index = 0; index < REFERENCE_LENGTH; index += 1) {
    reference += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)]
  }
  return `AB-${reference}`
}
