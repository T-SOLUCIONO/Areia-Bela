'use client'

import Image from 'next/image'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { de, enUS, es, fr, ptBR } from 'date-fns/locale'
import { Star } from 'lucide-react'
import { fill } from '@areia-bela/shared'
import { currency, type BookingQuote } from '@/lib/booking'
import { propertyData } from '@/lib/property-data'
import { translations, type Language } from '@/lib/i18n'

const DATE_LOCALES = { es, en: enUS, pt: ptBR, fr, de }

interface Props {
  quote: BookingQuote
  language: Language
  /** Already worded by the caller from the house's real policy. */
  policyText: string
  /** Opens the dialogs that edit the stay in place. */
  onChangeDates: () => void
  onChangeGuests: () => void
}

/**
 * Everything the guest is about to buy, in one card that stays on screen.
 *
 * The property, the dates, the party and the money used to be four separate
 * blocks scattered down the left column, above and below the forms — so by the
 * time someone reached the pay button, what they were paying for had scrolled
 * away. Here it travels with them.
 */
export function CheckoutSummary({
  quote,
  language,
  policyText,
  onChangeDates,
  onChangeGuests,
}: Props) {
  const copy = translations[language].checkout
  const quoteCopy = translations[language].quote
  const guestCopy = translations[language].guestArea
  const partyCopy = translations[language].availability
  const locale = DATE_LOCALES[language]

  const day = (value: string, pattern: string) => format(parseISO(value), pattern, { locale })

  // Borrowed rather than restated: the singular and plural already exist in
  // `availability` in all five languages.
  //
  // `guestArea.guests` is `'{count} huéspedes'` — a template with the plural
  // baked in, so a booking for one person read "1 huéspedes", and one pet read
  // "1 mascotas". Counting is not the same as pluralising.
  const guests = quote.guests.adults + quote.guests.children
  const party = [
    `${guests} ${(guests === 1 ? partyCopy.guestOne : partyCopy.guestMany).toLowerCase()}`,
    quote.guests.pets > 0 &&
      `${quote.guests.pets} ${(quote.guests.pets === 1 ? partyCopy.petsOne : partyCopy.petsMany).toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const lines: Array<{ label: string; amount: number; negative?: boolean }> = [
    {
      label: `${quote.nights} ${quoteCopy.nights} × ${currency(quote.pricePerNight)}`,
      amount: quote.subtotal,
    },
  ]
  // Only what is actually charged. The host can zero the cleaning or service
  // fee from the panel, and the line then stops existing rather than reading
  // "$0" — a charge the guest has to read and dismiss.
  if (quote.weeklyDiscount > 0) {
    lines.push({ label: quoteCopy.weeklyDiscount, amount: -quote.weeklyDiscount, negative: true })
  }
  if (quote.additionalGuestFee > 0) {
    lines.push({ label: guestCopy.billGuestFee, amount: quote.additionalGuestFee })
  }
  quote.extras.forEach((extra) => {
    if (extra.total > 0) lines.push({ label: extra.label, amount: extra.total })
  })
  if (quote.cleaningFee > 0) lines.push({ label: quoteCopy.cleaningFee, amount: quote.cleaningFee })
  if (quote.serviceFee > 0) lines.push({ label: quoteCopy.serviceFee, amount: quote.serviceFee })
  if (quote.taxes > 0) lines.push({ label: quoteCopy.taxes, amount: quote.taxes })

  return (
    <div className="overflow-hidden rounded-[24px] border border-border bg-card">
      <div className="flex gap-4 p-5">
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-[12px]">
          <Image
            src={propertyData.photos[0].large}
            alt={propertyData.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="font-medium leading-snug text-foreground">{propertyData.name}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
            <span className="font-medium text-foreground">{propertyData.rating.toFixed(2)}</span>
            <span>({propertyData.reviewsCount})</span>
          </p>
        </div>
      </div>

      <div className="border-t border-border px-5 py-4">
        <p className="font-medium text-foreground">{quoteCopy.freeCancellation}</p>
        <p className="mt-1 text-sm text-muted-foreground">{policyText}</p>
        <Link
          href="/#faqs"
          className="mt-1 inline-block text-sm font-medium text-foreground underline"
        >
          {copy.summaryFullPolicy}
        </Link>
      </div>

      <Row label={copy.summaryDates} action={copy.summaryChange} onAction={onChangeDates}>
        {day(quote.checkIn, 'd MMM')} – {day(quote.checkOut, 'd MMM yyyy')}
      </Row>

      <Row label={copy.summaryGuests} action={copy.summaryChange} onAction={onChangeGuests}>
        {party}
      </Row>

      <div className="border-t border-border px-5 py-4">
        <p className="font-medium text-foreground">{copy.summaryPriceDetails}</p>
        <dl className="mt-3 space-y-2">
          {lines.map((line) => (
            <div key={line.label} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd
                className={
                  line.negative ? 'tabular-nums text-emerald-700' : 'tabular-nums text-foreground'
                }
              >
                {line.negative ? '−' : ''}
                {currency(Math.abs(line.amount))}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
          <span className="font-medium text-foreground">{quoteCopy.total}</span>
          <span className="font-serif text-2xl tabular-nums text-foreground">
            {currency(quote.total)}
          </span>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  action,
  onAction,
  children,
}: {
  label: string
  action: string
  onAction: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border px-5 py-4">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>
      </div>
      {/* A button, not a link: it edits the booking in place rather than
          sending the guest back to the quoter to start again. */}
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-foreground underline hover:bg-muted"
      >
        {action}
      </button>
    </div>
  )
}
