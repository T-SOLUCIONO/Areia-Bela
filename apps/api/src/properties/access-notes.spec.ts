import {
  guestReadyAccessNotes,
  hasUnfilledPlaceholders,
  unfilledPlaceholders,
} from '@areia-bela/shared'

/**
 * The gate between a template and a guest.
 *
 * `accessNotes` is where a door code goes. Shipping the skeleton to someone
 * standing outside the house is the failure this guards against, so the rule is
 * pinned rather than trusted.
 */
describe('hasUnfilledPlaceholders', () => {
  it('spots the shipped template', () => {
    expect(
      hasUnfilledPlaceholders('Puerta principal: [cómo se abre — código, caja de llaves]'),
    ).toBe(true)
  })

  it('passes notes the host actually wrote', () => {
    expect(
      hasUnfilledPlaceholders('Aparca en la entrada. La puerta abre con el código 4821.'),
    ).toBe(false)
  })

  it('is not tripped by an empty field', () => {
    expect(hasUnfilledPlaceholders('')).toBe(false)
    expect(hasUnfilledPlaceholders(null)).toBe(false)
  })

  it('errs towards withholding, even on real bracketed prose', () => {
    // "[sic]" is not a placeholder, and this says it is. Deliberate: hiding
    // finished notes costs the guest an email, showing them "[cómo se abre]"
    // costs them a door they cannot open. The panel names what it found, so
    // the host can see why the block is not going out.
    expect(hasUnfilledPlaceholders('El timbre no va [sic], usa la aldaba.')).toBe(true)
  })

  it('names what it found, so the panel can explain itself', () => {
    expect(unfilledPlaceholders('Wi-Fi: red [nombre de la red], contraseña [contraseña]')).toEqual([
      '[nombre de la red]',
      '[contraseña]',
    ])
  })

  it('finds nothing in finished notes', () => {
    expect(unfilledPlaceholders('La puerta abre con el 4821.')).toEqual([])
  })

  it('catches a placeholder buried in a long note', () => {
    expect(
      hasUnfilledPlaceholders(
        'Aparca donde quieras en la entrada.\nWi-Fi: red AreiaBela, contraseña [contraseña]',
      ),
    ).toBe(true)
  })
})

describe('guestReadyAccessNotes', () => {
  it('hands over notes that are finished', () => {
    expect(guestReadyAccessNotes('La puerta abre con el 4821.')).toBe('La puerta abre con el 4821.')
  })

  it('withholds a template', () => {
    expect(guestReadyAccessNotes('Wi-Fi: [nombre de la red]')).toBeNull()
  })

  it('withholds nothing when there is nothing', () => {
    expect(guestReadyAccessNotes(null)).toBeNull()
  })
})
