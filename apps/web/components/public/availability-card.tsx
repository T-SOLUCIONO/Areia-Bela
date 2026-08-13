'use client'

import { useCallback, useEffect, useState } from 'react'
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { de, enUS, es, fr, ptBR } from 'date-fns/locale'
import { ChevronDown, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@areia-bela/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@areia-bela/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@areia-bela/ui/sheet'
import {
  currency,
  fetchNightRates,
  fetchQuote,
  fetchStayLimits,
  getBlockedDateRanges,
  saveQuoteToStorage,
  serializeQuoteToSearchParams,
  type BookingQuote,
} from '@/lib/booking'
import { PriceBreakdownCard } from '@/components/public/price-breakdown-card'
import { GuestPicker } from '@/components/public/guest-picker'
import { ServiceAnimalDialog } from '@/components/public/service-animal-dialog'
import {
  StayCalendar,
  StayCalendarWeekdays,
  type StayRange,
} from '@/components/public/stay-calendar'
import { useLanguage } from '@/components/language-provider'
import { fill, fullRefundDeadline, type CancellationPolicy } from '@areia-bela/shared'
import { translations } from '@/lib/i18n'
import { propertyData } from '@/lib/property-data'
import { cn } from '@/lib/utils'
import { PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query'

type Props = {
  className?: string
}

/** One end of the stay, with the button that clears it. */
function DateBox({
  label,
  value,
  onClear,
  clearLabel,
}: {
  label: string
  value?: Date
  onClear: () => void
  clearLabel: string
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-20">
        <p className="text-[10px] font-bold uppercase tracking-wide text-foreground">{label}</p>
        <p className="text-sm text-foreground">{value ? format(value, 'd/M/yyyy') : '—'}</p>
      </div>
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`${clearLabel}: ${label}`}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function AvailabilityCard({ className }: Props) {
  const router = useRouter()
  const { language } = useLanguage()
  const copy = translations[language].availability
  // "Desde" and "/ noche" live with the price strings, not with the calendar's.
  const fromCopy = translations[language].quote
  const locale = { es, en: enUS, pt: ptBR, fr, de }[language]
  /**
   * Empty until the guest picks.
   *
   * These used to open on a proposed stay, and it did more harm than good. The
   * proposal was computed from `new Date()` while rendering — on the server
   * too, where the clock is UTC and the guests are in Florida, so every evening
   * the markup disagreed with the browser and React threw it away (#418).
   *
   * And a pre-filled range made the calendar feel broken: with both ends
   * already set, the first tap on an arrival only moved the departure, so
   * choosing a stay took two taps and looked like one had been ignored.
   *
   * Nothing here reads the clock now, and an empty card asks a clear question
   * instead of answering one nobody asked.
   */
  const [checkIn, setCheckIn] = useState<Date | undefined>()
  const [checkOut, setCheckOut] = useState<Date | undefined>()
  const [guestsOpen, setGuestsOpen] = useState(false)
  const [serviceAnimalOpen, setServiceAnimalOpen] = useState(false)
  const [guests, setGuests] = useState({ adults: 1, children: 0, infants: 0, pets: 0 })
  const { adults, children, infants, pets } = guests
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  // Assume desktop on the server: a wide reader gets the popover at once and a
  // phone switches to the full-screen sheet on hydration.
  const isPhone = useMediaQuery(PHONE_QUERY, false)
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

  /**
   * Clearing the arrival clears the stay.
   *
   * A departure with no arrival is not a shorter stay, it is not a stay: the
   * calendar would show nothing selected while the header still read a date,
   * and the next click would drop it without saying so. Only the departure can
   * go on its own, which leaves a half-picked range the calendar can draw.
   */
  const clearStay = useCallback(() => {
    setCheckIn(undefined)
    setCheckOut(undefined)
  }, [])

  const clearDeparture = useCallback(() => {
    setCheckOut(undefined)
  }, [])

  useEffect(() => {
    const today = new Date()
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
    })
  }, [])

  /**
   * The cheapest night the server knows about, for the "from" price.
   *
   * Taken from the year of rates this card already fetches, not from the number
   * bundled in `property-data.ts`: a rate typed into the frontend is one that
   * goes stale in silence, and in this project the server owns pricing. Null
   * until that request lands, which is what the header falls back on.
   */
  const fromRate = rates.size > 0 ? Math.min(...rates.values()) : null

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

  /**
   * The one control that opens the calendar, whichever container holds it.
   *
   * It briefly opened by setting state from a plain `onClick`, outside Radix's
   * trigger. That takes two taps: the layer that has just mounted treats the
   * very click that opened it as an interaction outside itself and closes it
   * again. Wrapping it in each container's own `Trigger` is what makes one tap
   * enough — and it also gets the `aria-expanded` and focus return for free.
   */
  const dateTrigger = (
    <button
      type="button"
      className="mt-5 grid w-full grid-cols-2 divide-x divide-slate-200 overflow-hidden rounded-t-[14px] border border-b-0 border-border text-left"
    >
      {(
        [
          [copy.arrival, checkIn],
          [copy.departure, checkOut],
        ] as const
      ).map(([label, value], index) => (
        <span key={index} className="block px-4 py-2.5 transition hover:bg-muted">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-foreground">
            {label}
          </span>
          <span className="mt-0.5 block text-sm text-foreground">
            {value ? format(value, 'd/M/yyyy') : copy.addDate}
          </span>
        </span>
      ))}
    </button>
  )

  return (
    <aside
      /* Frosted rather than a solid white slab: it sits on the hero photo and
         the reference lets the water show through it, at the reference's own
         72%. Built from `--card`, so it frosts in either theme instead of
         dropping a bright panel into a dark page.

         What that transparency costs is legibility for grey text, so the lines
         inside carry full-strength ink instead — see the note on the header. */
      className={cn('glass shadow-float w-full rounded-3xl p-5 sm:p-6', className)}
    >
      {/* The price, then the promise.

          Every line here is `text-foreground`, not the reference's grey: the
          card is 72% opaque and sits on a hero photo that rotates through
          twelve images, where the muted token measured 3.17:1 against the
          brightest of them. The typographic hierarchy comes from size and
          weight, which a photograph cannot take away. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          {quote ? (
            <p className="text-[15px] text-foreground">
              <span className="font-display text-[26px] font-semibold underline decoration-foreground/25 underline-offset-4">
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
            <span className="block h-8 w-44 animate-pulse rounded-full bg-muted" aria-hidden />
          ) : fromRate ? (
            <>
              <p className="text-sm font-medium text-foreground">{fromCopy.from}</p>
              <p className="font-display text-3xl font-semibold text-foreground">
                {currency(fromRate)}{' '}
                <span className="text-base font-normal">{fromCopy.perNight}</span>
              </p>
            </>
          ) : (
            <p className="text-[15px] text-foreground">{copy.pickDates}</p>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-sand-foreground">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {copy.bestRate}
        </span>
      </div>

      {/* One trigger, two presentations.

          On a phone the calendar takes the screen: months stacked and scrolled
          instead of paged, each grid spanning both edges. A single month inside
          a popover, at cells barely wider than a fingertip, asked a guest
          comparing two weekends to remember the first one. Scrolling lets them
          look.

          Desktop keeps the popover, where two months already fit beside the
          card that produced them. */}
      {isPhone ? (
        <Sheet open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <SheetTrigger asChild>{dateTrigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="flex h-[100dvh] w-full flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none"
          >
            <SheetHeader className="gap-1 border-b border-border px-4 pb-3 pt-4 text-left">
              <SheetTitle className="text-[19px] font-semibold text-foreground">
                {nights === 0
                  ? copy.pickDates
                  : nights === 1
                    ? copy.nightSelected
                    : fill(copy.nightsSelected, { count: String(nights) })}
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                {checkIn && checkOut
                  ? `${format(checkIn, 'd MMM yyyy', { locale })} - ${format(checkOut, 'd MMM yyyy', { locale })}`
                  : checkIn
                    ? format(checkIn, 'd MMM yyyy', { locale })
                    : copy.addDate}
              </SheetDescription>
              {/* Pinned here rather than repeated above each of twelve months,
                  and still on screen when the guest reaches next spring. */}
              <div className="pt-2">
                <StayCalendarWeekdays language={language} />
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              <StayCalendar
                layout="stacked"
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
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={clearStay}
                className="text-sm font-medium text-foreground underline underline-offset-4 disabled:text-slate-300 disabled:no-underline"
                disabled={!checkIn && !checkOut}
              >
                {copy.clearDates}
              </button>
              <Button
                type="button"
                onClick={() => setIsCalendarOpen(false)}
                className="min-h-11 rounded-xl px-7"
              >
                {copy.close}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>{dateTrigger}</PopoverTrigger>
          <PopoverContent
            className="w-[min(100vw-1rem,760px)] rounded-[22px] border-border p-5 shadow-[0_24px_70px_rgba(15,23,42,0.14)]"
            align="end"
            sideOffset={10}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[22px] font-semibold leading-tight text-foreground">
                  {nights === 0
                    ? copy.pickDates
                    : nights === 1
                      ? copy.nightSelected
                      : fill(copy.nightsSelected, { count: String(nights) })}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {checkIn && checkOut
                    ? `${format(checkIn, 'd MMM yyyy', { locale })} - ${format(checkOut, 'd MMM yyyy', { locale })}`
                    : checkIn
                      ? format(checkIn, 'd MMM yyyy', { locale })
                      : ''}
                </p>
              </div>

              <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-[10px] border border-slate-800">
                {/* Written out rather than mapped over a tuple array. Two boxes
                  are two boxes; threading label, value and handler through
                  `[a, b, c] as const` obscured which callback belonged to which
                  date, and it read as render-time use of a handler that only
                  ever fires on a click. */}
                <DateBox
                  label={copy.arrival}
                  value={checkIn}
                  onClear={clearStay}
                  clearLabel={copy.clearDates}
                />
                <DateBox
                  label={copy.departure}
                  value={checkOut}
                  onClear={clearDeparture}
                  clearLabel={copy.clearDates}
                />
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

            <div className="mt-4 flex items-center justify-end gap-4 border-t border-border pt-4">
              <button
                type="button"
                onClick={clearStay}
                className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-foreground"
              >
                {copy.clearDates}
              </button>
              <Button type="button" onClick={() => setIsCalendarOpen(false)} className="rounded-lg">
                {copy.close}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            /* Transparent like the date boxes above it. A solid `bg-card` here
               put an opaque white slab in the middle of a frosted card, which
               made the guest row look like a different component. */
            className="w-full rounded-b-[14px] border border-border px-4 py-2.5 text-left transition hover:bg-secondary/60"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-foreground">
                  {copy.guests}
                </div>
                <div className="mt-0.5 text-sm text-foreground">{guestSummary}</div>
              </div>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-muted-foreground transition-transform',
                  guestsOpen && 'rotate-180',
                )}
              />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(100vw-1rem,440px)] rounded-[22px] border-border p-0 shadow-[0_24px_70px_rgba(15,23,42,0.14)]"
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

            <p className="border-t border-border pt-5 text-[13px] leading-6 text-muted-foreground">
              {fill(copy.capacityNote, { max: String(propertyData.capacity) })}
            </p>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setGuestsOpen(false)}
                className="text-[15px] font-medium text-foreground underline underline-offset-4"
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
              <span className="h-3 flex-1 animate-pulse rounded-full bg-muted" />
              <span className="h-3 w-14 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
          <div className="flex items-center justify-between gap-6 border-t border-border pt-3">
            <span className="h-4 w-20 animate-pulse rounded-full bg-muted" />
            <span className="h-5 w-24 animate-pulse rounded-full bg-muted" />
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
          className="mt-4 rounded-2xl bg-amber-50 dark:bg-amber-950 px-4 py-3 text-center text-[13px] text-amber-800 dark:text-amber-200"
        >
          {stayLength.kind === 'tooShort'
            ? fill(copy.minNights, { count: String(stayLength.minNights) })
            : fill(copy.maxNights, { count: String(stayLength.maxNights) })}
        </p>
      )}

      {quote && !stayLength && (
        <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-center text-[13px] text-foreground">
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
          that stops people hesitating over a booking button.

          Full-strength ink, like everything else that sits straight on the
          frosted surface: the muted token measured 4.2:1 there. */}
      <p className="mt-3 text-center text-[13px] text-foreground">{copy.noChargeYet}</p>

      <div className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-sm text-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-200" />
        <span>{copy.footer}</span>
      </div>
    </aside>
  )
}
