import { checkStayLength } from '@areia-bela/shared'

/**
 * How short and how long a stay may be.
 *
 * The calendar enforces the minimum too, but the calendar is a browser. These
 * are the limits the booking endpoint refuses on, so the edges matter.
 */
describe('checkStayLength', () => {
  const limits = { minNights: 3, maxNights: 30 }

  it('accepts a stay exactly at the minimum', () => {
    expect(checkStayLength(3, limits)).toBeNull()
  })

  it('accepts a stay exactly at the maximum', () => {
    expect(checkStayLength(30, limits)).toBeNull()
  })

  it('names the minimum rather than just refusing', () => {
    // The guest has to learn what to change. "Not available" would send them
    // back to the calendar to guess.
    expect(checkStayLength(2, limits)).toEqual({ kind: 'tooShort', minNights: 3, nights: 2 })
  })

  it('names the maximum', () => {
    expect(checkStayLength(31, limits)).toEqual({ kind: 'tooLong', maxNights: 30, nights: 31 })
  })

  it('says nothing about a stay with no nights yet', () => {
    // Only check-in is picked. Shouting "at least 3 nights" at someone who has
    // not chosen an end date is noise.
    expect(checkStayLength(0, limits)).toBeNull()
  })

  it('lets a one-night house through', () => {
    expect(checkStayLength(1, { minNights: 1, maxNights: 365 })).toBeNull()
  })
})
