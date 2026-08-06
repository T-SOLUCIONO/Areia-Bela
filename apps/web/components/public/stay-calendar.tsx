'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import { format, isWithinInterval, startOfDay, startOfMonth } from 'date-fns'
import { de, enUS, es, fr, ptBR } from 'date-fns/locale'
import { Calendar, CalendarDayButton } from '@areia-bela/ui/calendar'
import { type Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const DATE_LOCALES = { es, en: enUS, pt: ptBR, fr, de }

/** Two months need roughly this much width at the cell size below. */
const TWO_MONTH_QUERY = '(min-width: 46rem)'

/**
 * Whether two months fit side by side.
 *
 * `useSyncExternalStore` rather than an effect: the viewport is an external
 * system React should subscribe to, and this is the API for that. It also
 * takes a server value, so the first paint is not a guess that then jumps.
 *
 * The breakpoint is measured, not chosen. Two months at 3rem cells need about
 * 700px and the dialog they live in is capped at 768px minus its padding, so
 * below this the second month overflowed and the page grew a horizontal
 * scrollbar to show a calendar.
 */
function useTwoMonths(): boolean {
  const subscribe = useCallback((notify: () => void) => {
    const query = window.matchMedia(TWO_MONTH_QUERY)
    query.addEventListener('change', notify)
    return () => query.removeEventListener('change', notify)
  }, [])

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(TWO_MONTH_QUERY).matches,
    // On the server, assume the roomy case: a desktop reader gets the right
    // layout immediately and a phone corrects on hydration, rather than every
    // desktop flashing a single month first.
    () => true,
  )
}

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
  const locale = DATE_LOCALES[language]
  const twoMonths = useTwoMonths()
  // Read once per mount, not once per render. `startMonth`, `defaultMonth` and
  // the `before` matcher are all derived from it, so a fresh Date on every
  // render handed react-day-picker new bounds each time for no reason.
  const [today] = useState(() => new Date())
  const todayStart = startOfDay(today)

  const taken = (date: Date) => unavailable.has(format(date, 'yyyy-MM-dd'))
  const blocked = (date: Date) =>
    blockedRanges.some((range) => isWithinInterval(date, { start: range.from, end: range.to }))

  return (
    <div className={className}>
      <Calendar
        mode="range"
        selected={value.from ? { from: value.from, to: value.to } : undefined}
        numberOfMonths={twoMonths ? 2 : 1}
        // A month that is entirely behind us is a month nobody can book. The
        // dialog used to open on the current month and show the stay in the
        // second pane; when the stay was in August that meant a full grid of
        // dead July days. It opens where the stay is, and the arrow cannot go
        // back past the month we are in.
        startMonth={startOfMonth(today)}
        defaultMonth={value.from && value.from > today ? startOfMonth(value.from) : undefined}
        // Nights, not days. This read `minNights + 1` on the belief that
        // react-day-picker counts selected days and a one-night stay spans
        // two of them. It does not: `addToRange` compares
        // `differenceInCalendarDays(to, from)`, which is already a night count.
        //
        // The `+1` made a house that accepts one night demand two, and it
        // failed in the worst way — silently. Picking a departure one night
        // out returned `{ from: clicked, to: undefined }`, so the calendar
        // threw the range away and moved the arrival to the day just clicked.
        // Nothing looked broken; the dates simply refused to stick.
        min={minNights}
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
          // Split out from `disabled`, which also covers the past: the two
          // are unbookable for different reasons and should not look alike.
          // A night that is both past and taken stays hatched — the guest is
          // being told it is not for sale, which outranks the fact that it is
          // also behind us.
          past: (date) => date < todayStart && !taken(date) && !blocked(date),
          previewRange:
            value.from && !value.to && hoverDate && hoverDate > value.from
              ? { from: value.from, to: hoverDate }
              : [],
        }}
        modifiersClassNames={{
          // Slate, the same fill the panel uses for a night that is not for
          // sale. The strike-through and the diagonal hatch are the second and
          // third signals, so the state never rests on colour alone.
          //
          // The panel paints a booked night green and a blocked one slate. Here
          // they share one look on purpose: `/rates` returns a single
          // `available` flag, because which nights are sold and which the host
          // closed is occupancy data a stranger has no business reading.
          blocked:
            'line-through decoration-slate-400 decoration-[1.5px] text-slate-400 bg-slate-200/70 bg-[repeating-linear-gradient(135deg,transparent,transparent_3px,rgb(203_213_225)_3px,rgb(203_213_225)_6px)]',
          // Flat grey: a day that is simply gone. No hatch, no strike-through —
          // those say "someone has this", and nobody has yesterday.
          past: 'text-slate-400',
          previewRange: 'bg-[#174d7a]/10 rounded-none',
        }}
        classNames={{
          // The shared calendar paints today with `bg-accent`, and on this site
          // --accent is #173a57 — near enough to the selected blue that today
          // looked like a day the guest had already picked.
          // The same ring the panel puts on today, so "you are here" reads the
          // same on both sides of the product.
          today:
            'rounded-full ring-2 ring-ring ring-offset-2 ring-offset-white font-semibold data-[selected=true]:ring-0 data-[selected=true]:ring-offset-0',
          range_middle: 'rounded-none bg-[#174d7a]/10',
          range_start: 'rounded-l-full bg-[#174d7a]/10',
          range_end: 'rounded-r-full bg-[#174d7a]/10',
        }}
        onDayMouseEnter={onHoverDate}
        onDayMouseLeave={() => onHoverDate?.(undefined)}
        // Fluid rather than fixed: at a flat 3rem, two months needed more
        // width than the dialog had.
        className="w-full [--cell-size:clamp(2.25rem,7vw,3rem)]"
        components={{
          DayButton: (dayProps) => {
            const iso = format(dayProps.day.date, 'yyyy-MM-dd')
            const rate = rates.get(iso)
            const isPastFree =
              dayProps.day.date < todayStart && !unavailable.has(iso) && !blocked(dayProps.day.date)
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
                  // A free night to come: the panel's own "free" tint, so an
                  // available day looks available rather than merely blank.
                  'bg-secondary/30 hover:bg-[#f7f2ea]',
                  'data-[range-start=true]:bg-[#174d7a] data-[range-end=true]:bg-[#174d7a]',
                  unavailable.has(iso) && 'bg-transparent hover:bg-transparent',
                  // Painted on the button, not the cell: the cell's fill sits
                  // underneath and the free-night tint above would swallow it.
                  isPastFree && 'bg-slate-100 text-slate-400 hover:bg-slate-100',
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
    </div>
  )
}
