'use client'

import { useEffect, useState } from 'react'
import { addDays, differenceInCalendarDays, format, subDays } from 'date-fns'
import { de, enUS, es, fr, ptBR } from 'date-fns/locale'
import { ChevronDown, Minus, Plus, ShieldCheck, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@areia-bela/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@areia-bela/ui/dialog'
import { Calendar, CalendarDayButton } from '@areia-bela/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@areia-bela/ui/popover'
import {
  currency,
  fetchNightRates,
  fetchQuote,
  getBlockedDateRanges,
  saveQuoteToStorage,
  serializeQuoteToSearchParams,
  type BookingQuote,
} from '@/lib/booking'
import { PriceBreakdownCard } from '@/components/public/price-breakdown-card'
import { useLanguage } from '@/components/language-provider'
import { fill } from '@areia-bela/shared'
import { translations } from '@/lib/i18n'
import { propertyData } from '@/lib/property-data'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

export function AvailabilityCard({ className }: Props) {
  const router = useRouter()
  const { language } = useLanguage()
  const copy = translations[language].availability
  const locale = { es, en: enUS, pt: ptBR, fr, de }[language]
  const today = new Date()
  const [checkIn, setCheckIn] = useState<Date | undefined>(addDays(today, 1))
  const [checkOut, setCheckOut] = useState<Date | undefined>(addDays(today, 4))
  const [guestsOpen, setGuestsOpen] = useState(false)
  const [serviceAnimalOpen, setServiceAnimalOpen] = useState(false)
  const [guests, setGuests] = useState({ adults: 1, children: 0, infants: 0, pets: 0 })
  const { adults, children, infants, pets } = guests
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [blockedRanges, setBlockedRanges] = useState<Array<{ from: Date; to: Date }>>([])
  const [rates, setRates] = useState<Map<string, number>>(new Map())
  const [hoverDate, setHoverDate] = useState<Date | undefined>()

  useEffect(() => {
    getBlockedDateRanges().then(setBlockedRanges)

    // A year ahead: enough for both calendar months and any paging, in one
    // request rather than one per month change.
    const from = format(today, 'yyyy-MM-dd')
    const to = format(addDays(today, 365), 'yyyy-MM-dd')
    fetchNightRates(from, to).then((nights) => {
      setRates(new Map(nights.map((night) => [night.date, night.rate])))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [isPricing, setIsPricing] = useState(false)

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

  const updateGuest = (key: keyof typeof guests, delta: 1 | -1) => {
    setGuests((prev) => {
      const next = Math.max(0, prev[key] + delta)
      if (key === 'adults' && next < 1) return prev
      return { ...prev, [key]: next }
    })
  }

  const guestRows: Array<{
    key: keyof typeof guests
    title: string
    description: string
    hint?: string
  }> = [
    ...copy.guestRows.map((item, index) => ({
      key: ['adults', 'children', 'infants'][index] as keyof typeof guests,
      title: item.title,
      description: item.description,
    })),
    // Pets belong here rather than in a list of extras: a guest thinks of the
    // dog as part of the party, and the fee follows from the count.
    { key: 'pets', title: copy.petsTitle, description: '', hint: copy.serviceAnimal },
  ]

  const selectedRange = checkIn ? { from: checkIn, to: checkOut } : undefined
  const cancellationDate = checkIn ? format(subDays(checkIn, 5), 'd MMM', { locale }) : ''
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

          <Calendar
            mode="range"
            selected={selectedRange}
            numberOfMonths={2}
            min={1}
            // Each month shows only its own days. With the default, September
            // ends with October's first days and October starts with
            // September's last — the same date twice, side by side.
            showOutsideDays={false}
            onSelect={(range) => {
              setCheckIn(range?.from)
              setCheckOut(range?.to)
            }}
            disabled={[{ before: today }, ...blockedRanges]}
            modifiers={{
              blocked: blockedRanges,
              previewRange:
                checkIn && !checkOut && hoverDate && hoverDate > checkIn
                  ? { from: checkIn, to: hoverDate }
                  : [],
            }}
            modifiersClassNames={{
              blocked: 'line-through decoration-red-400 text-slate-300',
              previewRange: 'bg-slate-100 rounded-none',
            }}
            onDayMouseEnter={setHoverDate}
            onDayMouseLeave={() => setHoverDate(undefined)}
            className="w-full [--cell-size:3rem]"
            components={{
              DayButton: (dayProps) => {
                const rate = rates.get(format(dayProps.day.date, 'yyyy-MM-dd'))
                return (
                  <CalendarDayButton {...dayProps}>
                    {dayProps.day.date.getDate()}
                    {/* Shown so a guest sees the weekend costs more before
                        picking it, not after. */}
                    {rate !== undefined && <span>${rate}</span>}
                  </CalendarDayButton>
                )
              },
            }}
            initialFocus
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
            {guestRows.map((item, index) => {
              const value = guests[item.key]
              const floor = item.key === 'adults' ? 1 : 0
              // Infants and pets don't take a bed, so only adults and children
              // count against the house's capacity.
              const atCapacity =
                (item.key === 'adults' || item.key === 'children') &&
                adults + children >= propertyData.capacity

              return (
                <div
                  key={item.key}
                  className={cn(
                    'flex items-center justify-between gap-4 py-5',
                    index > 0 && 'border-t border-slate-200',
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[17px] font-medium leading-tight text-slate-900">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-1 text-[15px] leading-tight text-slate-500">
                        {item.description}
                      </p>
                    )}
                    {item.hint && (
                      <button
                        type="button"
                        onClick={() => setServiceAnimalOpen(true)}
                        className="mt-1 text-left text-[15px] leading-tight text-slate-700 underline underline-offset-2 hover:text-slate-900"
                      >
                        {item.hint}
                      </button>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      aria-label={`${item.title} −`}
                      disabled={value <= floor}
                      onClick={() => updateGuest(item.key, -1)}
                      className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-slate-600 transition enabled:hover:border-slate-800 enabled:hover:text-slate-900 disabled:border-slate-200 disabled:text-slate-300"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-6 text-center text-[16px] tabular-nums text-slate-900">
                      {value}
                    </span>
                    <button
                      type="button"
                      aria-label={`${item.title} +`}
                      disabled={atCapacity}
                      onClick={() => updateGuest(item.key, 1)}
                      className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-slate-600 transition enabled:hover:border-slate-800 enabled:hover:text-slate-900 disabled:border-slate-200 disabled:text-slate-300"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}

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

      {/* Says plainly that a service animal is not a pet and carries no fee —
          the question a guest would otherwise have to email to ask. */}
      <Dialog open={serviceAnimalOpen} onOpenChange={setServiceAnimalOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-[22px] p-0">
          <div className="relative aspect-[7/6] w-full bg-slate-100">
            <Image
              src="/images/mascota.png"
              alt={copy.serviceAnimalAlt}
              fill
              sizes="(max-width: 640px) 100vw, 512px"
              className="object-cover"
            />
          </div>

          <div className="space-y-4 p-6">
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-left font-serif text-2xl text-[#173a57]">
                {copy.serviceAnimalTitle}
              </DialogTitle>
            </DialogHeader>

            <p className="text-[15px] leading-7 text-slate-600">{copy.serviceAnimalBody}</p>
            <p className="text-[15px] leading-7 text-slate-600">{copy.serviceAnimalNote}</p>

            <div className="flex justify-end pt-1">
              <Button type="button" onClick={() => setServiceAnimalOpen(false)}>
                {copy.understood}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {checkIn && checkOut && quote && (
        <PriceBreakdownCard
          quote={quote}
          language={language}
          className="mt-4 shadow-none ring-1 ring-slate-100"
        />
      )}

      {/* No skeleton with numbers in it: a placeholder price is a wrong price. */}
      {checkIn && checkOut && !quote && (
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {isPricing
            ? language === 'en'
              ? 'Checking the price...'
              : 'Consultando el precio...'
            : language === 'en'
              ? 'We could not get the price right now. Please try again.'
              : 'No pudimos obtener el precio ahora mismo. Inténtalo de nuevo.'}
        </p>
      )}

      {quote && (
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-center text-[13px] text-slate-600">
          {fill(copy.cancelBefore, { date: cancellationDate })}
        </p>
      )}

      <Button
        onClick={handleReserve}
        disabled={!quote || isPricing}
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
