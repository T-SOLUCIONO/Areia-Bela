import Image from 'next/image'
import { format, parseISO, subDays } from 'date-fns'
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
  propertyPreview?: boolean
  className?: string
}

export function PriceBreakdownCard({ quote, language, propertyPreview = false, className }: Props) {
  const copy = translations[language].quote
  const cancellationDate = format(subDays(parseISO(quote.checkIn), 5), 'MMM d')
  const hasDiscount = quote.originalPricePerNight > quote.pricePerNight
  const savings = hasDiscount
    ? (quote.originalPricePerNight - quote.pricePerNight) * quote.nights
    : 0

  return (
    <div
      className={`rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] ${className ?? ''}`}
    >
      {propertyPreview && (
        <div className="flex gap-4 border-b border-slate-100 pb-5">
          <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-[14px]">
            <Image
              src={propertyData.photos[0].large}
              alt={propertyData.name}
              fill
              className="object-cover"
            />
          </div>
          <div>
            <p className="line-clamp-2 font-medium text-[#173a57]">{propertyData.name}</p>
            <div className="mt-1 flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-[#173a57] text-[#173a57]" />
              <span className="text-sm font-medium text-[#173a57]">
                {propertyData.rating.toFixed(2)}
              </span>
              <span className="text-sm text-slate-500">({propertyData.reviewsCount})</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 border-b border-slate-100 py-5">
        <div className="flex items-center justify-between">
          <span className="text-slate-600 underline">
            {currency(quote.pricePerNight)} x {quote.nights} {copy.nights}
          </span>
          <span className="text-slate-800">{currency(quote.subtotal)}</span>
        </div>

        {hasDiscount && savings > 0 && (
          <div className="flex items-center justify-between text-emerald-700">
            <span className="underline">{copy.weeklyDiscount}</span>
            <span>-{currency(savings)}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-slate-600 underline">{copy.cleaningFee}</span>
          <span className="text-slate-800">{currency(quote.cleaningFee)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600 underline">{copy.serviceFee}</span>
          <span className="text-slate-800">{currency(quote.serviceFee)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-600 underline">{copy.taxes}</span>
          <span className="text-slate-800">{currency(quote.taxes)}</span>
        </div>
      </div>

      <div className="pt-5">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-[#173a57]">{copy.total}</span>
          <span className="text-xl font-semibold text-[#173a57]">{currency(quote.total)}</span>
        </div>
      </div>

      <div className="mt-5 rounded-[16px] bg-[#f7f2ea] p-4">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 text-[#174d7a]" />
          <div>
            <p className="font-semibold text-[#173a57]">{copy.freeCancellation}</p>
            <p className="mt-1 text-sm text-slate-600">
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
