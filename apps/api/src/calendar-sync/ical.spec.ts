import { parseIcal } from './ical'

/**
 * Written against the real export of listing 1489399156507737323, so the shapes
 * here are the ones Airbnb actually sends: all-day events, two kinds of summary,
 * and a folded DESCRIPTION carrying guest data.
 */
const wrap = (...events: string[]) =>
  [
    'BEGIN:VCALENDAR',
    'PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN',
    'CALSCALE:GREGORIAN',
    'VERSION:2.0',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

const reservation = [
  'BEGIN:VEVENT',
  'DTSTAMP:20260814T164310Z',
  'DTSTART;VALUE=DATE:20260814',
  'DTEND;VALUE=DATE:20260822',
  'SUMMARY:Reserved',
  'UID:1418fb94e984-c07f605938ea8e5438916531a988f468@airbnb.com',
  'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/de',
  ' tails/HMSWTT92PA\\nPhone Number (Last 4 Digits): 2474',
  'END:VEVENT',
].join('\r\n')

const closedNight = [
  'BEGIN:VEVENT',
  'DTSTAMP:20260814T164310Z',
  'DTSTART;VALUE=DATE:20260813',
  'DTEND;VALUE=DATE:20260814',
  'SUMMARY:Airbnb (Not available)',
  'UID:7f662ec65913-8e73856aa74988c0ed85bf478b6210b0@airbnb.com',
  'END:VEVENT',
].join('\r\n')

describe('parseIcal', () => {
  it('ends the block the night before DTEND', () => {
    // The single most expensive thing to get wrong: DTEND is exclusive and
    // BlockedDate.endDate is not. Copying it across closes the check-out day,
    // which is a night the next guest can have.
    const [block] = parseIcal(wrap(reservation))

    expect(block.startDate).toBe('2026-08-14')
    expect(block.endDate).toBe('2026-08-21')
  })

  it('keeps a one-night block one night long', () => {
    const [block] = parseIcal(wrap(closedNight))

    expect(block.startDate).toBe('2026-08-13')
    expect(block.endDate).toBe('2026-08-13')
  })

  it('reads a folded DESCRIPTION without losing the event', () => {
    // The continuation line starts with a space and would otherwise be read as
    // a property of its own, taking the event down with it.
    expect(parseIcal(wrap(reservation))).toHaveLength(1)
  })

  it('carries no guest data out of the feed', () => {
    // The reservation URL and the last four digits of a phone number are in
    // there. Nothing in this system needs them to know a night is taken.
    const parsed = JSON.stringify(parseIcal(wrap(reservation)))

    expect(parsed).not.toContain('2474')
    expect(parsed).not.toContain('HMSWTT92PA')
    expect(parsed).not.toContain('Phone')
  })

  it('tells a paid stay from a closed night, and blocks both', () => {
    const blocks = parseIcal(wrap(reservation, closedNight))

    expect(blocks.map((block) => block.kind)).toEqual(['RESERVED', 'BLOCKED'])
  })

  it('keeps the UID, which is what makes re-importing idempotent', () => {
    const [block] = parseIcal(wrap(closedNight))

    expect(block.uid).toBe('7f662ec65913-8e73856aa74988c0ed85bf478b6210b0@airbnb.com')
  })

  it('drops an event that covers no night', () => {
    const sameDay = [
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260901',
      'DTEND;VALUE=DATE:20260901',
      'SUMMARY:Airbnb (Not available)',
      'UID:empty@airbnb.com',
      'END:VEVENT',
    ].join('\r\n')

    expect(parseIcal(wrap(sameDay))).toEqual([])
  })

  it('drops an event missing a UID or a date rather than guessing', () => {
    const noUid = [
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260901',
      'DTEND;VALUE=DATE:20260903',
      'SUMMARY:Reserved',
      'END:VEVENT',
    ].join('\r\n')
    const noEnd = [
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260901',
      'SUMMARY:Reserved',
      'UID:no-end@airbnb.com',
      'END:VEVENT',
    ].join('\r\n')

    expect(parseIcal(wrap(noUid, noEnd))).toEqual([])
  })

  it('survives a calendar with no events', () => {
    expect(parseIcal(wrap())).toEqual([])
    expect(parseIcal('')).toEqual([])
  })

  it('reads the whole listing the way the live feed sends it', () => {
    // The four ranges this calendar collapses to, checked against the export
    // fetched from Airbnb: 121 nights in total.
    const feed = wrap(
      reservation,
      closedNight,
      [
        'BEGIN:VEVENT',
        'DTSTART;VALUE=DATE:20261227',
        'DTEND;VALUE=DATE:20270102',
        'SUMMARY:Airbnb (Not available)',
        'UID:7f662ec65913-35aa871066443384e588a813961af216@airbnb.com',
        'END:VEVENT',
      ].join('\r\n'),
    )

    const nights = parseIcal(feed).reduce((total, block) => {
      const days =
        (Date.parse(`${block.endDate}T00:00:00Z`) - Date.parse(`${block.startDate}T00:00:00Z`)) /
        86_400_000
      return total + days + 1
    }, 0)

    expect(nights).toBe(8 + 1 + 6)
  })
})
