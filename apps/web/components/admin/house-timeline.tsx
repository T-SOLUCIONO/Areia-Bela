'use client'

import { useEffect, useState } from 'react'
import {
  addDays,
  format,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
} from 'date-fns'
import { es as esLocale, enUS } from 'date-fns/locale'
import { CalendarCheck, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { apiFetch } from '@/lib/api-client'
import { getBlockedDateRanges } from '@/lib/booking'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { cn } from '@/lib/utils'

const DAYS_SHOWN = 21

interface Stay {
  checkIn: string
  checkOut: string
  guestName: string
  status: string
}

/**
 * The one thing this business has that a hotel dashboard doesn't: a single
 * unit, so time is the only axis that matters. The panel opens with the house
 * itself across the next three weeks.
 *
 * Shows bookings and blocks as separate states. It used to draw only blocked
 * dates, so a paid stay appeared as a free night — on the first strip of the
 * first screen the host sees.
 */
export function HouseTimeline() {
  const { language } = useAdminLanguage()
  const isEnglish = language === 'en'
  const locale = isEnglish ? enUS : esLocale

  const [ranges, setRanges] = useState<Array<{ from: Date; to: Date }>>([])
  const [stays, setStays] = useState<Stay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void Promise.all([
      getBlockedDateRanges().then(setRanges, () => setRanges([])),
      apiFetch<Stay[]>('/bookings').then(
        (bookings) => setStays(bookings.filter((b) => b.status !== 'CANCELLED')),
        () => setStays([]),
      ),
    ]).finally(() => setLoading(false))
  }, [])

  const today = startOfDay(new Date())
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i))

  const blockedOn = (day: Date) =>
    ranges.some((r) => isWithinInterval(day, { start: startOfDay(r.from), end: startOfDay(r.to) }))

  // checkOut is a departure morning, not a night — the same rule the exclusion
  // constraint uses, so the strip and the database agree on who is in the house.
  const stayOn = (day: Date) =>
    stays.find(
      (s) =>
        !isBefore(day, startOfDay(parseISO(s.checkIn))) &&
        isBefore(day, startOfDay(parseISO(s.checkOut))),
    )

  const bookedCount = days.filter((day) => stayOn(day)).length
  const blockedCount = days.filter((day) => !stayOn(day) && blockedOn(day)).length
  const freeCount = DAYS_SHOWN - bookedCount - blockedCount

  const summary = isEnglish
    ? `${freeCount} free · ${bookedCount} booked · ${blockedCount} blocked`
    : `${freeCount} libres · ${bookedCount} reservadas · ${blockedCount} bloqueadas`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-xl">
          <CalendarCheck className="h-5 w-5 text-primary" />
          {isEnglish ? 'The house, next three weeks' : 'La casa, próximas tres semanas'}
        </CardTitle>
        <CardDescription>
          {loading
            ? isEnglish
              ? 'Checking availability...'
              : 'Consultando disponibilidad...'
            : summary}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex h-20 items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isEnglish ? 'Loading' : 'Cargando'}
          </div>
        ) : (
          <>
            <ol className="flex gap-1 overflow-x-auto pb-2">
              {days.map((day) => {
                const stay = stayOn(day)
                const blocked = !stay && blockedOn(day)
                const isToday = isSameDay(day, today)
                // The first night of a stay carries the name; repeating it for
                // seven days is noise, and dropping it entirely leaves a block
                // of colour with no explanation.
                const opensStay = stay && isSameDay(day, startOfDay(parseISO(stay.checkIn)))

                return (
                  <li
                    key={day.toISOString()}
                    title={
                      stay
                        ? `${stay.guestName} — ${format(day, 'PPPP', { locale })}`
                        : format(day, 'PPPP', { locale })
                    }
                    className={cn(
                      'flex min-w-[2.5rem] flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center transition-colors',
                      stay
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : blocked
                          ? 'border-slate-400 bg-slate-200 text-foreground'
                          : 'border-border bg-secondary/40 text-foreground',
                      isToday && 'ring-2 ring-ring ring-offset-2 ring-offset-card',
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wide opacity-70">
                      {format(day, 'EEEEE', { locale })}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{format(day, 'd')}</span>
                    <span className="h-3 w-full truncate text-[9px] leading-3 opacity-90">
                      {opensStay ? stay.guestName.split(' ')[0] : ''}
                    </span>
                  </li>
                )
              })}
            </ol>

            {/* Legend: identity is never colour alone — every state also has a
                label here and a tooltip on the cell itself. */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-border bg-secondary/40" />
                {isEnglish ? 'Free' : 'Libre'}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-emerald-600" />
                {isEnglish ? 'Booked' : 'Reservada'}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-slate-400 bg-slate-200" />
                {isEnglish ? 'Blocked by you' : 'Bloqueada por ti'}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded ring-2 ring-ring" />
                {isEnglish ? 'Today' : 'Hoy'}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
