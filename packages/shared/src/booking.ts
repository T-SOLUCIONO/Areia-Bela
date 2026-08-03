/**
 * How long a hold keeps the dates while the guest pays.
 *
 * Stripe refuses a checkout session that expires sooner than 30 minutes, so
 * this is the floor, not a preference: a hold shorter than the payment window
 * would free the dates while the guest is still on Stripe's page.
 */
export const HOLD_TTL_MINUTES = 30

/**
 * How long a payment link taken over the phone keeps the dates.
 *
 * Half an hour is right for someone already on the checkout page and wrong for
 * someone who has just hung up: they need to find the email, read it, and get
 * their card. Stripe will not hold a checkout session longer than 24 hours,
 * so this is the ceiling rather than a preference.
 */
export const PANEL_HOLD_TTL_MINUTES = 24 * 60

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

/**
 * Whether a text is still a template rather than an answer.
 *
 * `Property.accessNotes` ships as a skeleton with bracketed placeholders —
 * `[código de la puerta]` — so the host fills in answers instead of deciding
 * what to write about. Until she does, that text must not reach a guest: a
 * booking that says "Puerta principal: [cómo se abre]" is worse than one that
 * says nothing, because it looks like the house forgot rather than like the
 * information is coming separately.
 */
export function hasUnfilledPlaceholders(text: string | null | undefined): boolean {
  if (!text) return false
  // Any bracketed run at all.
  //
  // A heuristic, and biased on purpose. Withholding notes that were actually
  // finished costs the guest an email; showing them "Puerta principal: [cómo
  // se abre]" costs them a door they cannot open. So prose that genuinely uses
  // brackets — "[sic]" — trips this too, and the panel says exactly which
  // brackets it found so the host can see why.
  return /\[[^\][]{2,}\]/.test(text)
}

/** The bracketed runs, so the panel can name what is still missing. */
export function unfilledPlaceholders(text: string | null | undefined): string[] {
  if (!text) return []
  return [...new Set(text.match(/\[[^\][]{2,}\]/g) ?? [])]
}

/** The notes, or null while they are still a template. */
export function guestReadyAccessNotes(text: string | null | undefined): string | null {
  if (!text || hasUnfilledPlaceholders(text)) return null
  return text
}
