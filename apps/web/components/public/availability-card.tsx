'use client'

import { useEffect, useState } from 'react'
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { de, enUS, es, fr, ptBR } from 'date-fns/locale'
import { ChevronDown, ShieldCheck, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@areia-bela/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@areia-bela/ui/popover'
import {
  currency,
  fetchNightRates,
  fetchQuote,
  fetchStayLimits,
  getBlockedDateRanges,
  saveQuoteToStorage,
  serializeQuoteToSearchParams,
  type BookingQuote,
  type NightRate,
} from '@/lib/booking'
import { PriceBreakdownCard } from '@/components/public/price-breakdown-card'
import { GuestPicker } from '@/components/public/guest-picker'
import { ServiceAnimalDialog } from '@/components/public/service-animal-dialog'
import { StayCalendar, type StayRange } from '@/components/public/stay-calendar'
import { useLanguage } from '@/components/language-provider'
import { fill, fullRefundDeadline, type CancellationPolicy } from '@areia-bela/shared'
import { translations } from '@/lib/i18n'
import { propertyData } from '@/lib/property-data'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

/** How long the card proposes before the guest touches anything. */
const DEFAULT_NIGHTS = 3

/**
 * The first run of free nights long enough for the default stay.
 *
 * Returns the check-out date too, which is the morning after the last night —
 * so a three-night stay needs three free nights, not four.
 */
function findFirstFreeStay(nights: NightRate[], wanted: number): { from: Date; to: Date } | null {
  let run = 0
  for (let index = 0; index < nights.length; index += 1) {
    run = nights[index].available ? run + 1 : 0
    if (run === wanted) {
      const first = nights[index - wanted + 1].date
      return { from: parseISO(first), to: addDays(parseISO(nights[index].date), 1) }
    }
  }
  return null
}

export function AvailabilityCard({ className }: Props) {
  const router = useRouter()
  const { language } = useLanguage()
  const copy = translations[language].availability
  const locale = { es, en: enUS, pt: ptBR, fr, de }[language]
  const today = new Date()
  // Replaced once the rates arrive, if these nights turn out to be taken.
  const [checkIn, setCheckIn] = useState<Date | undefined>(addDays(today, 1))
  const [checkOut, setCheckOut] = useState<Date | undefined>(addDays(today, 1 + DEFAULT_NIGHTS))
  const [guestsOpen, setGuestsOpen] = useState(false)
  const [serviceAnimalOpen, setServiceAnimalOpen] = useState(false)
  const [guests, setGuests] = useState({ adults: 1, children: 0, infants: 0, pets: 0 })
  const { adults, children, infants, pets } = guests
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [blockedRanges, setBlockedRanges] = useState<Array<{ from: Date; to: Date }>>([])
  const [rates, setRates] = useState<Map<string, number>>(new Map())
  // Nights already taken, by a booking or by the host. The endpoint has always
  // returned this; the card used to keep only the price and throw it away, so
  // a guest could pick a week that was sold and only find out at checkout.
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set())
  const [hoverDate, setHoverDate] = useState<Date | undefined>()
  // Mirrors the house's rule in the calendar itself. The server is still the
  // authority — this only stops the guest picking something it would refuse.
  const [minNights, setMinNights] = useState(1)
  const [policy, setPolicy] = useState<CancellationPolicy>('MODERATE')

  useEffect(() => {
    getBlockedDateRanges().then(setBlockedRanges)
    fetchStayLimits().then((terms) => {
      setMinNights(terms.minNights)
      setPolicy(terms.cancellationPolicy)
    })

    // A year ahead: enough for both calendar months and any paging, in one
    // request rather than one per month change.
    const from = format(today, 'yyyy-MM-dd')
    const to = format(addDays(today, 365), 'yyyy-MM-dd')
    fetchNightRates(from, to).then((nights) => {
      setRates(new Map(nights.map((night) => [night.date, night.rate])))

      const taken = new Set(nights.filter((night) => !night.available).map((n) => n.date))
      setUnavailable(taken)

      // Opening on dates that are already sold sends the guest to a 409 at the
      // end of a form. The default was tomorrow-plus-three regardless of who
      // was in the house then, so it moves to the first free stretch instead.
      const stay = findFirstFreeStay(nights, DEFAULT_NIGHTS)
      if (stay) {
        setCheckIn((current) =>
          current && !taken.has(format(current, 'yyyy-MM-dd')) ? current : stay.from,
        )
        setCheckOut((current) =>
          current && !taken.has(format(current, 'yyyy-MM-dd')) ? current : stay.to,
        )
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [isPricing, setIsPricing] = useState(false)
  /** True only after an attempt finished with nothing. */
  const [priceFailed, setPriceFailed] = useState(false)

  const checkInIso = checkIn ? format(checkIn, 'yyyy-MM-dd') : ''
  const checkOutIso = checkOut ? format(checkOut, 'yyyy-MM-dd') : ''

  // The price comes from the API, so it changes with the dates rather than
  // being computed here. `cancelled` guards against a slow first response
  // landing after a faster second one and showing a stale total.
  useEffect(() => {
    if (!checkInIso || !checkOutIso) {
      setQuote(null)
      return
    }

    let cancelled = false
    setIsPricing(true)
    setPriceFailed(false)
    void fetchQuote({
      checkIn: checkInIso,
      checkOut: checkOutIso,
      guests: { adults, children, infants, pets },
      // The pet fee is an extra priced by how many animals come along.
      selectedExtraIds: pets > 0 ? ['pet'] : [],
      extraUnits: pets > 0 ? { pet: pets } : {},
    }).then((result) => {
      if (cancelled) return
      setQuote(result)
      // Distinct from "not started": `isPricing` alone would flash the failure
      // message on the first render, before the effect has had a chance to run.
      setPriceFailed(result === null)
      setIsPricing(false)
    })

    return () => {
      cancelled = true
    }
  }, [checkInIso, checkOutIso, adults, children, infants])

  const guestTotal = adults + children
  const guestSummary = [
    `${guestTotal} ${guestTotal === 1 ? copy.guestOne : copy.guestMany}`,
    infants > 0 && `${infants} ${infants === 1 ? copy.babiesOne : copy.babiesMany}`,
    pets > 0 && `${pets} ${pets === 1 ? copy.petsOne : copy.petsMany}`,
  ]
    .filter(Boolean)
    .join(', ')

  const handleReserve = () => {
    if (!quote) return
    saveQuoteToStorage(quote)
    router.push(`/checkout?${serializeQuoteToSearchParams(quote)}`)
  }

  const stayLength = quote?.stayLength ?? null
  // Derived from the house's policy, not a hard-coded five days: the two
  // agreed by accident under MODERATE and would have diverged the moment the
  // host changed it.
  const refundDeadline = checkIn && fullRefundDeadline(format(checkIn, 'yyyy-MM-dd'), policy)
  const cancellationDate = refundDeadline
    ? format(parseISO(refundDeadline), 'd MMM', { locale })
    : ''
  const nights = checkIn && checkOut ? differenceInCalendarDays(checkOut, checkIn) : 0

  return (
    <aside
      className={cn(
        'w-full rounded-[28px] bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] ring-1 ring-black/5 sm:p-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {quote ? (
          <p className="text-[15px] text-slate-600">
            <span className="text-[26px] font-semibold text-slate-900 underline decoration-slate-900/25 underline-offset-4">
              {currency(quote.total)} USD
            </span>{' '}
            {quote.nights === 1
              ? copy.perNightOne
              : fill(copy.perNights, { count: String(quote.nights) })}
          </p>
        ) : isPricing ? (
          // The dates are chosen; only the figure is missing. Saying "pick
          // your dates" here would be telling the guest to redo what they
          // just did.
          <span className="h-8 w-44 animate-pulse rounded-full bg-slate-100" aria-hidden />
        ) : (
          <p className="text-[15px] text-slate-600">{copy.pickDates}</p>
        )}
        <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200/70">
          {copy.guaranteed}
        </span>
      </div>

      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          {/* One bordered box divided in two, sharing its middle rule with the
              guest row below — the shape the reference uses. */}
          <button
            type="button"
            className="mt-5 grid w-full grid-cols-2 divide-x divide-slate-200 overflow-hidden rounded-t-[14px] border border-b-0 border-slate-300 text-left"
          >
            {(
              [
                [copy.arrival, checkIn],
                [copy.departure, checkOut],
              ] as const
            ).map(([label, value], index) => (
              <span key={index} className="block px-4 py-2.5 transition hover:bg-slate-50">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-800">
                  {label}
                </span>
                <span className="mt-0.5 block text-sm text-slate-700">
                  {value ? format(value, 'd/M/yyyy') : copy.addDate}
                </span>
              </span>
            ))}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(100vw-1rem,760px)] rounded-[22px] border-slate-200 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.14)]"
          align="end"
          sideOffset={10}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[22px] font-semibold leading-tight text-slate-900">
                {nights === 1
                  ? copy.nightSelected
                  : fill(copy.nightsSelected, { count: String(nights) })}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {checkIn && checkOut
                  ? `${format(checkIn, 'd MMM yyyy', { locale })} - ${format(checkOut, 'd MMM yyyy', { locale })}`
                  : copy.pickDates}
              </p>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-300 overflow-hidden rounded-[10px] border border-slate-800">
              {(
                [
                  [copy.arrival, checkIn, () => setCheckIn(undefined)],
                  [copy.departure, checkOut, () => setCheckOut(undefined)],
                ] as const
              ).map(([label, value, clear], index) => (
                <div key={index} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-20">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-800">
                      {label}
                    </p>
                    <p className="text-sm text-slate-700">
                      {value ? format(value, 'd/M/yyyy') : '—'}
                    </p>
                  </div>
                  {value && (
                    <button
                      type="button"
                      onClick={clear}
                      aria-label={`${copy.clearDates}: ${label}`}
                      className="shrink-0 rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <StayCalendar
            value={{ from: checkIn, to: checkOut }}
            onChange={(range: StayRange) => {
              setCheckIn(range.from)
              setCheckOut(range.to)
            }}
            unavailable={unavailable}
            blockedRanges={blockedRanges}
            rates={rates}
            minNights={minNights}
            language={language}
            hoverDate={hoverDate}
            onHoverDate={setHoverDate}
          />

          <div className="mt-4 flex items-center justify-end gap-4 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setCheckIn(undefined)
                setCheckOut(undefined)
              }}
              className="text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
            >
              {copy.clearDates}
            </button>
            <Button type="button" onClick={() => setIsCalendarOpen(false)} className="rounded-lg">
              {copy.close}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full rounded-b-[14px] border border-slate-300 bg-white px-4 py-2.5 text-left transition hover:bg-slate-50"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-800">
                  {copy.guests}
                </div>
                <div className="mt-0.5 text-sm text-slate-700">{guestSummary}</div>
              </div>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-slate-500 transition-transform',
                  guestsOpen && 'rotate-180',
                )}
              />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(100vw-1rem,440px)] rounded-[22px] border-slate-200 p-0 shadow-[0_24px_70px_rgba(15,23,42,0.14)]"
          align="start"
          sideOffset={10}
        >
          <div className="px-6 py-5">
            <GuestPicker
              value={guests}
              onChange={setGuests}
              maxGuests={propertyData.capacity}
              onServiceAnimal={() => setServiceAnimalOpen(true)}
              language={language}
            />

            <p className="border-t border-slate-200 pt-5 text-[13px] leading-6 text-slate-500">
              {fill(copy.capacityNote, { max: String(propertyData.capacity) })}
            </p>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setGuestsOpen(false)}
                className="text-[15px] font-medium text-slate-900 underline underline-offset-4"
              >
                {copy.close}
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <ServiceAnimalDialog
        open={serviceAnimalOpen}
        onOpenChange={setServiceAnimalOpen}
        language={language}
      />

      {checkIn && checkOut && quote && (
        <PriceBreakdownCard
          quote={quote}
          policy={policy}
          language={language}
          className="mt-4 shadow-none ring-1 ring-slate-100"
        />
      )}

      {/* Shape without figures. A skeleton that shows the rows coming is
          honest; one with placeholder numbers in it would be a wrong price on
          screen for as long as the request takes. */}
      {checkIn && checkOut && !quote && !priceFailed && (
        <div
          role="status"
          aria-label={copy.pricing}
          className="mt-4 space-y-3 rounded-2xl p-4 ring-1 ring-slate-100"
        >
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-6">
              <span className="h-3 flex-1 animate-pulse rounded-full bg-slate-100" />
              <span className="h-3 w-14 animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
          <div className="flex items-center justify-between gap-6 border-t border-slate-100 pt-3">
            <span className="h-4 w-20 animate-pulse rounded-full bg-slate-200" />
            <span className="h-5 w-24 animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>
      )}

      {/* Only once the attempt has actually finished and failed. */}
      {checkIn && checkOut && !quote && priceFailed && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {copy.pricingFailed}
        </p>
      )}

      {/* The stay is priced but too short or too long. Says the limit rather
          than just refusing, so the guest knows what to change. */}
      {stayLength && (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-center text-[13px] text-amber-800"
        >
          {stayLength.kind === 'tooShort'
            ? fill(copy.minNights, { count: String(stayLength.minNights) })
            : fill(copy.maxNights, { count: String(stayLength.maxNights) })}
        </p>
      )}

      {quote && !stayLength && (
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-center text-[13px] text-slate-600">
          {fill(copy.cancelBefore, { date: cancellationDate })}
        </p>
      )}

      <Button
        onClick={handleReserve}
        disabled={!quote || isPricing || stayLength !== null}
        variant="brand"
        size="lg"
        className="mt-3 w-full text-sm font-semibold shadow-none"
      >
        {copy.reserveCta}
      </Button>

      {/* Says out loud that the button does not take money — the single line
          that stops people hesitating over a booking button. */}
      <p className="mt-3 text-center text-[13px] text-slate-500">{copy.noChargeYet}</p>

      <div className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <span>{copy.footer}</span>
      </div>
    </aside>
  )
}
