'use client'

import { useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { CalendarDays, ChevronDown, Minus, Plus, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@areia-bela/ui/button'
import { Calendar } from '@areia-bela/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@areia-bela/ui/popover'
import { buildQuote, saveQuoteToStorage, serializeQuoteToSearchParams } from '@/lib/booking'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

export function AvailabilityCard({ className }: Props) {
  const router = useRouter()
  const { language } = useLanguage()
  const copy = translations[language].availability
  const today = new Date()
  const [checkIn, setCheckIn] = useState<Date | undefined>(addDays(today, 1))
  const [checkOut, setCheckOut] = useState<Date | undefined>(addDays(today, 4))
  const [guestsOpen, setGuestsOpen] = useState(false)
  const [guests, setGuests] = useState({ adults: 1, children: 0, infants: 0 })
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  const quote = useMemo(
    () =>
      buildQuote({
        checkIn: checkIn ? format(checkIn, 'yyyy-MM-dd') : '',
        checkOut: checkOut ? format(checkOut, 'yyyy-MM-dd') : '',
        guests: { ...guests, pets: 0 },
        selectedExtraIds: [],
      }),
    [checkIn, checkOut, guests],
  )

  const guestTotal = guests.adults + guests.children
  const guestSummary = `${guestTotal} ${guestTotal === 1 ? copy.guestOne : copy.guestMany}${guests.infants > 0 ? `, ${guests.infants} ${guests.infants === 1 ? copy.babiesOne : copy.babiesMany}` : ''}`

  const handleReserve = () => {
    if (!checkIn || !checkOut) return
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

  const guestRows = copy.guestRows.map((item, index) => ({
    key: ['adults', 'children', 'infants'][index] as keyof typeof guests,
    title: item.title,
    description: item.description,
  }))

  const selectedRange = checkIn ? { from: checkIn, to: checkOut } : undefined

  return (
    <aside
      className={cn(
        'w-full rounded-[28px] bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] ring-1 ring-black/5 sm:p-6',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold text-[#173a57]">{copy.title}</p>
        </div>
        <div className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200/70">
          {copy.guaranteed}
        </div>
      </div>

      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="mt-5 grid w-full grid-cols-2 gap-3 text-left">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-slate-300 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium text-slate-500">{copy.checkIn}</div>
                  <div className="mt-0.5 text-sm text-slate-800">
                    {checkIn ? format(checkIn, 'MMM d') : copy.addDate}
                  </div>
                </div>
                <CalendarDays className="h-4 w-4 text-slate-500" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-slate-300 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium text-slate-500">{copy.checkOut}</div>
                  <div className="mt-0.5 text-sm text-slate-800">
                    {checkOut ? format(checkOut, 'MMM d') : copy.addDate}
                  </div>
                </div>
                <CalendarDays className="h-4 w-4 text-slate-500" />
              </div>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={selectedRange}
            numberOfMonths={2}
            min={1}
            onSelect={(range) => {
              setCheckIn(range?.from)
              setCheckOut(range?.to)
            }}
            disabled={{ before: today }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="mt-3 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium text-slate-500">{copy.guests}</div>
                <div className="mt-0.5 text-sm text-slate-800">{guestSummary}</div>
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
          <div className="space-y-5 px-5 py-5">
            {guestRows.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[22px] font-semibold leading-tight text-slate-900">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[16px] leading-tight text-slate-500">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    aria-label={`Decrease ${item.title}`}
                    disabled={guests[item.key] <= (item.key === 'adults' ? 1 : 0)}
                    onClick={() => updateGuest(item.key, -1)}
                    className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400 transition enabled:hover:bg-slate-200 enabled:hover:text-slate-700 disabled:opacity-50"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <span className="min-w-6 text-center text-[24px] text-slate-900">
                    {guests[item.key]}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${item.title}`}
                    onClick={() => updateGuest(item.key, 1)}
                    className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        onClick={handleReserve}
        disabled={!checkIn || !checkOut}
        className="mt-4 h-12 w-full rounded-xl bg-[#174d7a] text-sm font-semibold uppercase tracking-wide text-white shadow-none hover:bg-[#0f4068]"
      >
        {copy.reserve}
      </Button>

      <div className="mt-4 flex items-start gap-2 text-sm text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <span>{copy.footer}</span>
      </div>
    </aside>
  )
}
