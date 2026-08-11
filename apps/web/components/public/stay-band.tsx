'use client'

import { format, parseISO } from 'date-fns'
import { de, enUS, es, fr, ptBR } from 'date-fns/locale'
import type { Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const DATE_LOCALES = { es, en: enUS, pt: ptBR, fr, de }

interface Props {
  checkIn: string
  checkOut: string
  nights: number
  /** "3 nights", already pluralised in the guest's language. */
  nightsLabel: string
  arrivalLabel: string
  departureLabel: string
  checkInTime?: string
  checkOutTime?: string
  className?: string
}

/**
 * A stay drawn as what it is: two anchored ends and the span between them.
 *
 * The same shape the booking calendar uses for a selected range, so a guest
 * who picked their dates on the home page meets the same figure again on the
 * confirmation, in the email's sibling page, and in their booking history.
 * Dates listed as two separate fields read as two facts; this reads as one
 * stay, which is what they bought.
 */
export function StayBand({
  checkIn,
  checkOut,
  nights,
  nightsLabel,
  arrivalLabel,
  departureLabel,
  checkInTime,
  checkOutTime,
  language,
  className,
}: Props & { language: Language }) {
  const locale = DATE_LOCALES[language]
  const day = (value: string) => format(parseISO(value), 'd MMM', { locale })
  const year = (value: string) => format(parseISO(value), 'yyyy', { locale })
  const weekday = (value: string) => format(parseISO(value), 'EEEE', { locale })

  return (
    <div className={cn('flex items-stretch gap-4', className)}>
      <End
        label={arrivalLabel}
        weekday={weekday(checkIn)}
        day={day(checkIn)}
        year={year(checkIn)}
        time={checkInTime}
      />

      {/* The span. Its width is the whole point, so it takes the free space. */}
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center pt-6">
        <span className="text-xs font-medium uppercase tracking-wider text-primary">
          {nightsLabel}
        </span>
        <div className="mt-1.5 flex w-full items-center" aria-hidden>
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          <span className="h-px flex-1 bg-primary/30" />
          <span className="text-[10px] tabular-nums text-muted-foreground">{nights}</span>
          <span className="h-px flex-1 bg-primary/30" />
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
        </div>
      </div>

      <End
        label={departureLabel}
        weekday={weekday(checkOut)}
        day={day(checkOut)}
        year={year(checkOut)}
        time={checkOutTime}
        align="right"
      />
    </div>
  )
}

function End({
  label,
  weekday,
  day,
  year,
  time,
  align = 'left',
}: {
  label: string
  weekday: string
  day: string
  year: string
  time?: string
  align?: 'left' | 'right'
}) {
  return (
    <div className={cn('shrink-0', align === 'right' && 'text-right')}>
      <p className="text-xs font-medium uppercase tracking-wider text-primary">{label}</p>
      <p className="mt-1 font-serif text-2xl leading-none text-foreground">{day}</p>
      <p className="mt-1 text-sm capitalize text-muted-foreground">
        {weekday} · {year}
      </p>
      {time && <p className="text-xs text-muted-foreground">{time}</p>}
    </div>
  )
}
