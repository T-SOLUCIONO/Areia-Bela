'use client'

import { useEffect, useState } from 'react'
import { addDays, format, isSameDay, isWithinInterval, startOfDay } from 'date-fns'
import { es as esLocale, enUS } from 'date-fns/locale'
import { CalendarCheck, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { getBlockedDateRanges } from '@/lib/booking'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { cn } from '@/lib/utils'

const DAYS_SHOWN = 21

/**
 * The one thing this business has that a hotel dashboard doesn't: a single
 * unit, so time is the only axis that matters. Instead of four generic stat
 * tiles, the panel opens with the house itself across the next three weeks.
 *
 * Uses the real blocked-date endpoint — it is the only live business data the
 * admin has today, so it is the one thing here that isn't invented.
 */
export function HouseTimeline() {
  const { language } = useAdminLanguage()
  const isEnglish = language === 'en'
  const locale = isEnglish ? enUS : esLocale

  const [ranges, setRanges] = useState<Array<{ from: Date; to: Date }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBlockedDateRanges()
      .then(setRanges)
      .finally(() => setLoading(false))
  }, [])

  const today = startOfDay(new Date())
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i))
  const isBlocked = (day: Date) =>
    ranges.some((r) => isWithinInterval(day, { start: startOfDay(r.from), end: startOfDay(r.to) }))

  const blockedCount = days.filter(isBlocked).length
  const freeCount = DAYS_SHOWN - blockedCount

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
            : isEnglish
              ? `${freeCount} nights free, ${blockedCount} taken`
              : `${freeCount} noches libres, ${blockedCount} ocupadas`}
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
                const blocked = isBlocked(day)
                const isToday = isSameDay(day, today)

                return (
                  <li
                    key={day.toISOString()}
                    title={format(day, 'PPPP', { locale })}
                    className={cn(
                      'flex min-w-[2.5rem] flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center transition-colors',
                      blocked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary/40 text-foreground',
                      isToday && 'ring-2 ring-ring ring-offset-2 ring-offset-card',
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wide opacity-70">
                      {format(day, 'EEEEE', { locale })}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{format(day, 'd')}</span>
                  </li>
                )
              })}
            </ol>

            {/* Legend: identity is never colour alone. */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-border bg-secondary/40" />
                {isEnglish ? 'Free' : 'Libre'}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-primary" />
                {isEnglish ? 'Taken or blocked' : 'Ocupada o bloqueada'}
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
