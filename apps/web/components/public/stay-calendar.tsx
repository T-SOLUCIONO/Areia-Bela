'use client'

import { useCallback, useMemo, useState } from 'react'
import { format, isWithinInterval, startOfDay, startOfMonth } from 'date-fns'
import { de, enUS, es, fr, ptBR } from 'date-fns/locale'
import { Calendar, CalendarDayButton } from '@areia-bela/ui/calendar'
import { type Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/lib/use-media-query'

const DATE_LOCALES = { es, en: enUS, pt: ptBR, fr, de }

/** Two months need roughly this much width at the cell size below. */
const TWO_MONTH_QUERY = '(min-width: 46rem)'

/** How far ahead the stacked calendar lets a guest scroll in one go. */
const STACKED_MONTHS = 12

/**
 * The weekday row, drawn once above a stacked calendar.
 *
 * The stacked layout hides react-day-picker's own copy — twelve identical rows
 * between twelve months is noise — so this stands in, pinned to the top of the
 * sheet where it stays useful while the guest scrolls into next spring.
 *
 * Built from the locale rather than hard-coded: Spanish weeks start on Monday
 * and English ones on Sunday, and a header that disagrees with the grid beneath
 * it is worse than no header.
 */
export function StayCalendarWeekdays({ language }: { language: Language }) {
  const locale = DATE_LOCALES[language]
  const firstDay = locale.options?.weekStartsOn ?? 0
  // Any week will do; this one starts on a Sunday.
  const reference = new Date(2026, 0, 4)

  return (
    <div className="flex" aria-hidden>
      {Array.from({ length: 7 }, (_, index) => {
        const date = new Date(reference)
        date.setDate(reference.getDate() + ((firstDay + index) % 7))
        return (
          <div
            key={index}
            className="flex-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {format(date, 'EEEEE', { locale })}
          </div>
        )
      })}
    </div>
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
  /**
   * `stacked` is the phone layout: months one under another, scrolled rather
   * than paged, each grid filling the screen's width. A month at a time inside
   * a popover means a guest comparing two weekends has to remember the first
   * one — scrolling lets them look.
   */
  layout?: 'paged' | 'stacked'
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
  layout = 'paged',
}: Props) {
  const locale = DATE_LOCALES[language]
  const stacked = layout === 'stacked'
  // Assume the roomy case on the server: a desktop reader gets the right
  // layout at once and a phone corrects itself on hydration.
  const twoMonths = useMediaQuery(TWO_MONTH_QUERY, true)
  // Read once per mount, not once per render. `startMonth`, `defaultMonth` and
  // the `before` matcher are all derived from it, so a fresh Date on every
  // render handed react-day-picker new bounds each time for no reason.
  const [today] = useState(() => new Date())
  // Frozen at mount, because that is what a *default* month is. Recomputing it
  // meant handing react-day-picker a different starting month mid-session — a
  // new `Date` on every render once an arrival was picked — and the grid was
  // rebuilt underneath the pointer each time.
  const [defaultMonth] = useState(() =>
    value.from && value.from > new Date() ? startOfMonth(value.from) : undefined,
  )
  // Memorizado por el mismo motivo que `components` de abajo: `startOfDay`
  // devuelve un `Date` nuevo cada vez, y ese objeto es una dependencia del
  // memo que mantiene estable el tipo del boton de dia.
  const todayStart = useMemo(() => startOfDay(today), [today])

  const taken = useCallback(
    (date: Date) => unavailable.has(format(date, 'yyyy-MM-dd')),
    [unavailable],
  )
  const blocked = useCallback(
    (date: Date) =>
      blockedRanges.some((range) => isWithinInterval(date, { start: range.from, end: range.to })),
    [blockedRanges],
  )

  /**
   * Kept stable across renders, and that is the whole point.
   *
   * This was an arrow function written inline in `components={{ ... }}`, so
   * every render produced a **new component type** and React unmounted and
   * remounted all sixty-one day buttons. Hovering a day calls `onHoverDate`,
   * which re-renders — so moving the pointer onto a day replaced the node
   * underneath it. The `mousedown` landed on the old element and the `mouseup`
   * on its replacement, and a browser only fires `click` when both hit the
   * same node.
   *
   * The visible symptom was a calendar that ignored the first tap and answered
   * the second. Nothing in the handler was wrong; the button it belonged to no
   * longer existed by the time the finger came up.
   *
   * `hoverDate` deliberately does not appear below: the preview band is drawn
   * by a modifier, so hovering never has to rebuild this.
   */
  const components = useMemo(
    () => ({
      DayButton: (dayProps: React.ComponentProps<typeof CalendarDayButton>) => {
        const iso = format(dayProps.day.date, 'yyyy-MM-dd')
        const rate = rates.get(iso)
        const isPastFree =
          dayProps.day.date < todayStart && !unavailable.has(iso) && !blocked(dayProps.day.date)
        return (
          <CalendarDayButton
            {...dayProps}
            className={cn(
              // Neutralises the shared button's dark `bg-accent` on mid-range
              // days: the tint lives on the cell, so check-in and check-out are
              // the only solid blocks and the stay reads as a band with two ends.
              'rounded-full data-[range-middle=true]:bg-transparent data-[range-middle=true]:text-[#173a57]',
              'data-[range-start=true]:bg-[#174d7a] data-[range-end=true]:bg-[#174d7a]',
              'data-[selected-single=true]:bg-[#174d7a]',
              // A free night to come: the panel's own "free" tint, so an
              // available day looks available rather than merely blank.
              'bg-secondary/30 hover:bg-[#f7f2ea]',
              unavailable.has(iso) && 'bg-transparent hover:bg-transparent',
              // Painted on the button, not the cell: the cell's fill sits
              // underneath and the free-night tint above would swallow it.
              isPastFree && 'bg-slate-100 text-slate-400 hover:bg-slate-100',
            )}
          >
            {dayProps.day.date.getDate()}
            {/* So a guest sees the weekend costs more before picking it, not
                after. A night that cannot be booked has no price worth quoting. */}
            {rate !== undefined && !unavailable.has(iso) && <span>${rate}</span>}
          </CalendarDayButton>
        )
      },
    }),
    [rates, unavailable, todayStart, blocked],
  )

  /**
   * Hover, reported only when it changes something.
   *
   * `onDayMouseEnter` used to be wired straight to the parent's setter, and it
   * handed over a fresh `Date` every time. React never bails out of a state
   * update whose value is a new object, so the grid re-rendered, the node under
   * the pointer was replaced, `mouseenter` fired again on the replacement, and
   * round it went — one hover measured **sixty** renders of a single day cell.
   *
   * That is what made the calendar need two taps: `mousedown` landed on one
   * element and `mouseup` on its successor, and a browser only reports a click
   * when both hit the same node.
   *
   * Two guards. The preview band only exists while a stay is half-picked, so
   * outside that there is nothing to track; and the same day is never reported
   * twice, so the state settles instead of oscillating.
   */
  // Nuevos arrays y objetos en cada render obligaban a react-day-picker a
  // recalcular el estado de cada dia aunque nada hubiera cambiado.
  const disabled = useMemo(
    () => [{ before: today }, ...blockedRanges, taken],
    [today, blockedRanges, taken],
  )

  const isPicking = Boolean(value.from && !value.to)
  const handleDayEnter = useCallback(
    (date: Date) => {
      if (hoverDate && hoverDate.getTime() === date.getTime()) return
      onHoverDate?.(date)
    },
    [hoverDate, onHoverDate],
  )
  const handleDayLeave = useCallback(() => {
    if (hoverDate) onHoverDate?.(undefined)
  }, [hoverDate, onHoverDate])

  return (
    <div className={className}>
      <Calendar
        mode="range"
        selected={value.from ? { from: value.from, to: value.to } : undefined}
        numberOfMonths={stacked ? STACKED_MONTHS : twoMonths ? 2 : 1}
        // A month that is entirely behind us is a month nobody can book. The
        // dialog used to open on the current month and show the stay in the
        // second pane; when the stay was in August that meant a full grid of
        // dead July days. It opens where the stay is, and the arrow cannot go
        // back past the month we are in.
        startMonth={startOfMonth(today)}
        defaultMonth={defaultMonth}
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
        // A click on a finished stay starts a new one.
        //
        // react-day-picker would instead drag the nearest end to meet it: with
        // 10–14 chosen, clicking the 20th gives 10–20, and clicking the 8th
        // gives 8–14. Neither is what someone means by tapping a different day
        // — they are choosing again, and the old range is in the way.
        //
        // So the guest never has to clear before re-picking, and the arrival
        // always lands where they tapped. `triggerDate` is the day itself,
        // which is the one thing the library's proposed range does not tell us.
        onSelect={(range, triggerDate) =>
          value.from && value.to
            ? onChange({ from: triggerDate, to: undefined })
            : onChange({ from: range?.from, to: range?.to })
        }
        // Booked nights included: blocked ranges come from a different
        // endpoint and cover only what the host closed by hand.
        disabled={disabled}
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
          // --- Solo en el modo apilado -------------------------------------
          // El calendario compartido es `w-fit`, que es lo correcto dentro de
          // un popover y lo que impide llenar una pantalla.
          ...(stacked
            ? {
                root: 'w-full',
                // Un mes debajo de otro, con aire suficiente para que el
                // nombre del siguiente no parezca el pie del anterior.
                months: 'flex flex-col gap-9',
                month: 'flex w-full flex-col gap-3',
                // Alineado a la izquierda como un encabezado, no centrado como
                // un control: aquí no hay nada que pulsar, se desplaza.
                month_caption: 'px-1 justify-start h-auto',
                caption_label: 'text-[17px] font-semibold text-slate-900',
                // Las flechas sobran cuando el gesto es deslizar, y ocupan el
                // sitio del nombre del mes.
                nav: 'hidden',
                // La fila de días de la semana se dibuja una sola vez, fija en
                // la cabecera de la hoja. Repetirla doce veces es ruido.
                weekdays: 'hidden',
              }
            : {}),
        }}
        onDayMouseEnter={isPicking ? handleDayEnter : undefined}
        onDayMouseLeave={isPicking ? handleDayLeave : undefined}
        // Fluid rather than fixed: at a flat 3rem, two months needed more
        // width than the dialog had.
        className={cn(
          'w-full',
          // Siete columnas exactas del ancho disponible: es lo que hace que la
          // rejilla llegue a los dos bordes en vez de quedarse en el centro.
          stacked ? '[--cell-size:calc((100vw-2rem)/7)]' : '[--cell-size:clamp(2.25rem,7vw,3rem)]',
        )}
        components={components}
      />
    </div>
  )
}
