/**
 * Just enough iCalendar to read a booking calendar, and nothing more.
 *
 * No library: what Airbnb publishes is a flat list of all-day VEVENTs, and the
 * general-purpose parsers bring recurrence rules, timezone databases and
 * alarms — none of which appears in this feed — along with their own bugs. What
 * does need care is below, and it is three things.
 */

/** A range of nights, already in this system's own terms. */
export interface IcalBlock {
  /** The event's UID, stable across Airbnb's exports. */
  uid: string
  /** `yyyy-mm-dd`, the first night. */
  startDate: string
  /** `yyyy-mm-dd`, the last night — inclusive, like `BlockedDate`. */
  endDate: string
  /** A stay someone paid for, or a night the host closed. Both block. */
  kind: 'RESERVED' | 'BLOCKED'
}

const DAY = 86_400_000

/**
 * Undoes RFC 5545 line folding.
 *
 * A long value continues on the next line with one leading space or tab, and
 * Airbnb folds every DESCRIPTION. A parser that reads line by line without
 * joining these sees `tails/HMSWTT92PA` as a property name and gives up on the
 * event — or worse, keeps going with half a field.
 */
function unfold(text: string): string[] {
  const lines: string[] = []
  for (const line of text.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && lines.length > 0) lines[lines.length - 1] += line.slice(1)
    else lines.push(line)
  }
  return lines
}

/** `20260814` → `2026-08-14`. Date-only values carry no timezone, which is why
 *  a booking calendar can be read without knowing where anyone is. */
function toIso(value: string): string | null {
  const digits = value.trim().slice(0, 8)
  if (!/^\d{8}$/.test(digits)) return null
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

const shiftDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)

/**
 * Every event in the feed, as blocks of nights.
 *
 * Two things this deliberately does:
 *
 * **`DTEND` is exclusive and `BlockedDate.endDate` is not.** A stay of
 * `DTSTART:20260814 / DTEND:20260822` is the nights of the 14th to the **21st**;
 * the 22nd is when they leave, and the next guest can arrive that morning.
 * Copying `DTEND` across would close one sellable night per event — twelve of
 * them in the calendar this was written against.
 *
 * **`DESCRIPTION` is never read.** Airbnb puts the reservation's private URL and
 * the last four digits of the guest's phone number in there. None of that is
 * needed to know a night is taken, so none of it is carried into this system.
 */
export function parseIcal(text: string): IcalBlock[] {
  const blocks: IcalBlock[] = []
  let event: Record<string, string> | null = null

  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') {
      event = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (event) {
        const block = toBlock(event)
        if (block) blocks.push(block)
      }
      event = null
      continue
    }
    if (!event) continue

    const separator = line.indexOf(':')
    if (separator < 1) continue
    // `DTSTART;VALUE=DATE` — the parameters after the semicolon are not part of
    // the name, and for an all-day feed they carry nothing worth keeping.
    const name = line.slice(0, separator).split(';')[0].toUpperCase()
    event[name] = line.slice(separator + 1)
  }

  return blocks
}

function toBlock(event: Record<string, string>): IcalBlock | null {
  const uid = event.UID?.trim()
  const start = event.DTSTART ? toIso(event.DTSTART) : null
  const end = event.DTEND ? toIso(event.DTEND) : null
  if (!uid || !start || !end) return null

  // Exclusive to inclusive. An event that ends the day it starts covers no
  // night at all, and is dropped rather than stored inside out.
  const lastNight = shiftDays(end, -1)
  if (lastNight < start) return null

  return {
    uid,
    startDate: start,
    endDate: lastNight,
    // Airbnb writes "Reserved" for a stay and "Airbnb (Not available)" for a
    // closed night. The distinction is only for the host to read later; both
    // stop the house being sold twice.
    kind: event.SUMMARY?.trim() === 'Reserved' ? 'RESERVED' : 'BLOCKED',
  }
}
