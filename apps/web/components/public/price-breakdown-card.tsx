import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import { fullRefundDeadline, type CancellationPolicy } from '@areia-bela/shared'
import { Clock, Info, Star } from 'lucide-react'
import { currency, type BookingQuote } from '@/lib/booking'
import { propertyData } from '@/lib/property-data'
import { translations, type Language } from '@/lib/i18n'

type Props = {
  quote: BookingQuote
  /**
   * The language, not a boolean. This was `isEnglish`, which quietly meant
   * "English or Spanish" — so once the site spoke five languages, a French
   * guest read the price breakdown in Spanish.
   */
  language: Language
  /**
   * The house's cancellation policy. Passed in rather than fetched here: this
   * card renders inside pages that already know it, and a second request per
   * render would be a request per keystroke on the quoter.
   */
  policy?: CancellationPolicy
  propertyPreview?: boolean
  className?: string
}

export function PriceBreakdownCard({
  quote,
  language,
  policy = 'MODERATE',
  propertyPreview = false,
  className,
}: Props) {
  const copy = translations[language].quote
  // The house's policy decides this date, not a hard-coded five days. Passed
  // in rather than fetched: this card renders inside pages that already know.
  const cancellationDate = policy
    ? (() => {
        const deadline = fullRefundDeadline(quote.checkIn, policy)
        return deadline ? format(parseISO(deadline), 'MMM d') : ''
      })()
    : ''
  // The server's figure, not a "was" price from the listing.
  //
  // This used to be `(originalPricePerNight - pricePerNight) * nights`, where
  // `originalPricePerNight` is a static marketing price unrelated to the
  // long-stay discount. It showed a "weekly discount" on a two-night booking,
  // for an amount nobody was being charged, while the real `weeklyDiscount`
  // sat in the same object unused.
  const savings = quote.weeklyDiscount
  const hasDiscount = savings > 0

  return (
    <div
      className={`rounded-[24px] border border-border bg-card p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] ${className ?? ''}`}
    >
      {propertyPreview && (
        <div className="flex gap-4 border-b border-border pb-5">
          <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-[14px]">
            <Image
              src={propertyData.photos[0].large}
              alt={propertyData.name}
              fill
              className="object-cover"
            />
          </div>
          <div>
            <p className="line-clamp-2 font-medium text-foreground">{propertyData.name}</p>
            <div className="mt-1 flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
              <span className="text-sm font-medium text-foreground">
                {propertyData.rating.toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">({propertyData.reviewsCount})</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 border-b border-border py-5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground underline">
            {currency(quote.pricePerNight)} x {quote.nights} {copy.nights}
          </span>
          <span className="text-foreground">{currency(quote.subtotal)}</span>
        </div>

        {hasDiscount && savings > 0 && (
          <div className="flex items-center justify-between text-emerald-700">
            <span className="underline">{copy.weeklyDiscount}</span>
            <span>-{currency(savings)}</span>
          </div>
        )}

        {/* Only what is actually charged. A line reading "$0" is a charge the
            guest has to read and dismiss; the host can set the cleaning or
            service fee to zero from the panel and it simply stops appearing. */}
        {quote.cleaningFee > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground underline">{copy.cleaningFee}</span>
            <span className="text-foreground">{currency(quote.cleaningFee)}</span>
          </div>
        )}

        {quote.serviceFee > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground underline">{copy.serviceFee}</span>
            <span className="text-foreground">{currency(quote.serviceFee)}</span>
          </div>
        )}

        {quote.taxes > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground underline">{copy.taxes}</span>
            <span className="text-foreground">{currency(quote.taxes)}</span>
          </div>
        )}
      </div>

      <div className="pt-5">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-foreground">{copy.total}</span>
          <span className="text-xl font-semibold text-foreground">{currency(quote.total)}</span>
        </div>
      </div>

      <div className="mt-5 rounded-[16px] bg-background p-4">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold text-foreground">{copy.freeCancellation}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.cancelBefore} {cancellationDate} {copy.partialRefund}
            </p>
          </div>
        </div>
      </div>

      {hasDiscount && savings > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-[16px] bg-emerald-50 p-3">
          <Info className="mt-0.5 h-4 w-4 text-emerald-700" />
          <p className="text-sm text-emerald-800">
            {copy.saving} <span className="font-semibold">{currency(savings)}</span>{' '}
            {copy.withDiscount}
          </p>
        </div>
      )}
    </div>
  )
}
