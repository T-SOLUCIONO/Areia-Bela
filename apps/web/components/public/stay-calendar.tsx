'use client'

import { format } from 'date-fns'
import { de, enUS, es, fr, ptBR } from 'date-fns/locale'
import { Calendar, CalendarDayButton } from '@areia-bela/ui/calendar'
import { translations, type Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const DATE_LOCALES = { es, en: enUS, pt: ptBR, fr, de }

export interface StayRange {
  from?: Date
  to?: Date
}

interface Props {
  value: StayRange
  onChange: (range: StayRange) => void
  /** Nights already taken, as ISO dates. */
  unavailable: Set<string>
  blockedRanges: Array<{ from: Date; to: Date }>
  /** Nightly price per ISO date, for the figure under each day. */
  rates: Map<string, number>
  minNights: number
  language: Language
  hoverDate?: Date
  onHoverDate?: (date?: Date) => void
  className?: string
}

/**
 * The booking calendar, in one place.
 *
 * Shared by the quoter and the checkout's "change dates" dialog. What counts as
 * unavailable, how short a stay may be, and how a taken night is drawn are
 * rules — duplicating them into a second calendar would be duplicating the
 * rules, and the two would drift the first time one changed.
 */
export function StayCalendar({
  value,
  onChange,
  unavailable,
  blockedRanges,
  rates,
  minNights,
  language,
  hoverDate,
  onHoverDate,
  className,
}: Props) {
  const copy = translations[language].availability
  const locale = DATE_LOCALES[language]
  const today = new Date()

  const taken = (date: Date) => unavailable.has(format(date, 'yyyy-MM-dd'))

  return (
    <div className={className}>
      <Calendar
        mode="range"
        selected={value.from ? { from: value.from, to: value.to } : undefined}
        numberOfMonths={2}
        // react-day-picker's `min` counts selected days, and check-out is a
        // departure morning rather than a night — so one night is a two-day
        // range.
        min={minNights + 1}
        // Each month shows only its own days. With the default, September ends
        // with October's first days and October starts with September's last —
        // the same date twice, side by side.
        showOutsideDays={false}
        locale={locale}
        onSelect={(range) => onChange({ from: range?.from, to: range?.to })}
        disabled={[
          { before: today },
          ...blockedRanges,
          // Booked nights. Blocked ranges come from a different endpoint and
          // cover only what the host closed by hand.
          taken,
        ]}
        modifiers={{
          blocked: [...blockedRanges, taken],
          previewRange:
            value.from && !value.to && hoverDate && hoverDate > value.from
              ? { from: value.from, to: hoverDate }
              : [],
        }}
        modifiersClassNames={{
          // A struck-through, greyed day reads as "sold" without a legend. The
          // diagonal fill is the second signal, so the state does not rest on
          // colour alone.
          blocked:
            'line-through decoration-slate-400 decoration-[1.5px] text-slate-300 bg-[repeating-linear-gradient(135deg,transparent,transparent_3px,rgb(241_245_249)_3px,rgb(241_245_249)_6px)]',
          previewRange: 'bg-[#174d7a]/10 rounded-none',
        }}
        classNames={{
          // The shared calendar paints today with `bg-accent`, and on this site
          // --accent is #173a57 — near enough to the selected blue that today
          // looked like a day the guest had already picked.
          today:
            'rounded-full ring-2 ring-inset ring-[#174d7a]/45 font-semibold data-[selected=true]:ring-0',
          range_middle: 'rounded-none bg-[#174d7a]/10',
          range_start: 'rounded-l-full bg-[#174d7a]/10',
          range_end: 'rounded-r-full bg-[#174d7a]/10',
        }}
        onDayMouseEnter={onHoverDate}
        onDayMouseLeave={() => onHoverDate?.(undefined)}
        className="w-full [--cell-size:3rem]"
        components={{
          DayButton: (dayProps) => {
            const iso = format(dayProps.day.date, 'yyyy-MM-dd')
            const rate = rates.get(iso)
            return (
              <CalendarDayButton
                {...dayProps}
                className={cn(
                  // Neutralises the shared button's dark `bg-accent` on
                  // mid-range days: the tint lives on the cell, so check-in and
                  // check-out are the only solid blocks and the stay reads as a
                  // band with two ends.
                  'rounded-full data-[range-middle=true]:bg-transparent data-[range-middle=true]:text-[#173a57]',
                  'data-[range-start=true]:bg-[#174d7a] data-[range-end=true]:bg-[#174d7a]',
                  'data-[selected-single=true]:bg-[#174d7a]',
                  'hover:bg-[#f7f2ea]',
                  unavailable.has(iso) && 'hover:bg-transparent',
                )}
              >
                {dayProps.day.date.getDate()}
                {/* So a guest sees the weekend costs more before picking it,
                    not after. A night that cannot be booked has no price worth
                    quoting. */}
                {rate !== undefined && !unavailable.has(iso) && <span>${rate}</span>}
              </CalendarDayButton>
            )
          },
        }}
      />

      {/* Named, not only coloured: three fills in one grid is exactly the point
          where a legend stops being decoration. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full ring-2 ring-inset ring-[#174d7a]/45" />
          {copy.legendToday}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex items-center">
            <span className="h-3.5 w-3.5 rounded-l-full bg-[#174d7a]" />
            <span className="h-3.5 w-2.5 bg-[#174d7a]/10" />
            <span className="h-3.5 w-3.5 rounded-r-full bg-[#174d7a]" />
          </span>
          {copy.legendSelected}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-sm bg-[repeating-linear-gradient(135deg,transparent,transparent_3px,rgb(226_232_240)_3px,rgb(226_232_240)_6px)] ring-1 ring-inset ring-slate-200" />
          <span className="line-through decoration-slate-400">{copy.legendTaken}</span>
        </span>
      </div>
    </div>
  )
}
