'use client'

import { format, parseISO } from 'date-fns'
import { de, enUS, es, fr, ptBR } from 'date-fns/locale'
import { Info, MapPin, ScrollText, Trash2 } from 'lucide-react'
import { fill, fullRefundDeadline, halfRefundDeadline } from '@areia-bela/shared'
import type { MyBooking } from '@/lib/guest-client'
import { translations, type Language } from '@/lib/i18n'

const DATE_LOCALES = { es, en: enUS, pt: ptBR, fr, de }

/**
 * A known date per weekday, so date-fns can spell the name in any of the five
 * languages instead of this file carrying thirty-five translations.
 * 2024-01-01 was a Monday.
 */
const WEEKDAY_REFERENCE: Record<string, string> = {
  monday: '2024-01-01',
  tuesday: '2024-01-02',
  wednesday: '2024-01-03',
  thursday: '2024-01-04',
  friday: '2024-01-05',
  saturday: '2024-01-06',
  sunday: '2024-01-07',
}

/**
 * The terms and the practical facts, in one block.
 *
 * Everything here comes from something the host wrote or chose: the
 * cancellation policy is a field on the property, the rules are the CMS page,
 * the bin days are the property's own list. Blocks with nothing behind them
 * are not rendered — a "House rules" heading over an empty box is worse than
 * no heading.
 */
export function BookingTerms({ booking, language }: { booking: MyBooking; language: Language }) {
  const copy = translations[language].guestArea
  const locale = DATE_LOCALES[language]

  const day = (value: string | null) => (value ? format(parseISO(value), 'd MMMM', { locale }) : '')

  const full = fullRefundDeadline(booking.checkIn, booking.cancellationPolicy)
  const half = halfRefundDeadline(booking.checkIn, booking.cancellationPolicy)

  const policyText = {
    FLEXIBLE: copy.policyFlexible,
    MODERATE: fill(copy.policyModerate, { date: day(full) }),
    FIRM: fill(copy.policyFirm, { date: day(full), half: day(half) }),
    STRICT: fill(copy.policyStrict, { half: day(half) }),
  }[booking.cancellationPolicy]

  const facts: Array<{ icon: typeof Info; label: string; value: string }> = [
    { icon: MapPin, label: copy.addressLabel, value: booking.address },
  ]
  if (booking.accessNotes) {
    facts.push({ icon: Info, label: copy.accessNotes, value: booking.accessNotes })
  }
  if (booking.trashCollectionDays.length > 0) {
    // Stored as English keys; spelled out in the guest's language. "wednesday"
    // on a booking reads like a database column.
    const spelled = booking.trashCollectionDays.map((key) => {
      const reference = WEEKDAY_REFERENCE[key.toLowerCase()]
      return reference ? format(parseISO(reference), 'EEEE', { locale }) : key
    })
    facts.push({ icon: Trash2, label: copy.trashDays, value: spelled.join(', ') })
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.policyTitle}
        </h3>
        <p className="mt-2 text-sm text-foreground">{policyText}</p>
        <p className="mt-1 text-xs text-muted-foreground">{copy.policyNote}</p>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.goodToKnow}
        </h3>
        <ul className="mt-3 space-y-3">
          {facts.map((fact) => (
            <li key={fact.label} className="flex items-start gap-2.5 text-sm">
              <fact.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="text-muted-foreground">{fact.label}: </span>
                <span className="text-foreground">{fact.value}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {booking.houseRules && (
        <section>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ScrollText className="h-3.5 w-3.5" />
            {copy.houseRules}
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {booking.houseRules}
          </p>
        </section>
      )}
    </div>
  )
}
