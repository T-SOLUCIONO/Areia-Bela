'use client'

import { useEffect, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { enUS, es as esLocale } from 'date-fns/locale'
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { getBlockedDateRanges } from '@/lib/booking'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'
import { cn } from '@/lib/utils'

/**
 * One reservable unit, so availability is a single line through time — not the
 * rooms × dates matrix this page used to be. There is nothing to put on a
 * second row.
 *
 * Blocked dates come from the real API, which makes this the only fully live
 * screen in the panel.
 */
export default function CalendarPage() {
  const { language, t } = useAdminLanguage()
  const locale = language === 'en' ? enUS : esLocale

  const [monthOffset, setMonthOffset] = useState(0)
  const [ranges, setRanges] = useState<Array<{ from: Date; to: Date }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBlockedDateRanges()
      .then(setRanges)
      .catch(() => toast.error(t.calendar.loadFailed))
      .finally(() => setLoading(false))
  }, [t.calendar.loadFailed])

  const today = startOfDay(new Date())
  const month = addMonths(startOfMonth(today), monthOffset)

  // Padded to whole weeks so the columns always line up. Not memoized: it is
  // 42 dates, and a manual useMemo here stops the React Compiler optimizing
  // the component at all.
  const grid = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })

  const isBlocked = (day: Date) =>
    ranges.some((r) => isWithinInterval(day, { start: startOfDay(r.from), end: startOfDay(r.to) }))

  const monthDays = grid.filter((d) => isSameMonth(d, month))
  const blockedCount = monthDays.filter(isBlocked).length
  const freeCount = monthDays.length - blockedCount

  const weekdayLabels = eachDayOfInterval({
    start: startOfWeek(today, { weekStartsOn: 1 }),
    end: endOfWeek(today, { weekStartsOn: 1 }),
  }).map((day) => format(day, 'EEEEEE', { locale }))

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle className="font-serif text-xl capitalize">
            {format(month, 'LLLL yyyy', { locale })}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? t.common.loading
              : `${fill(t.calendar.nightsFree, { count: String(freeCount) })} · ${fill(
                  t.calendar.nightsBlocked,
                  { count: String(blockedCount) },
                )}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={language === 'en' ? 'Previous month' : 'Mes anterior'}
            onClick={() => setMonthOffset((o) => o - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonthOffset(0)}>
            {t.calendar.today}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={language === 'en' ? 'Next month' : 'Mes siguiente'}
            onClick={() => setMonthOffset((o) => o + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {/* Honest about not being built: says so instead of pretending. */}
          <Button variant="brand" size="sm" onClick={() => toast.info(t.calendar.comingSoon)}>
            <CalendarPlus className="h-4 w-4" />
            {t.calendar.blockDates}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.common.loading}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center sm:gap-2">
              {weekdayLabels.map((label) => (
                <div
                  key={label}
                  className="pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {label}
                </div>
              ))}

              {grid.map((day) => {
                const outside = !isSameMonth(day, month)
                const blocked = isBlocked(day)
                const past = isBefore(day, today)
                const isToday = isSameDay(day, today)

                return (
                  <div
                    key={day.toISOString()}
                    title={format(day, 'PPPP', { locale })}
                    className={cn(
                      'flex aspect-square items-start justify-end rounded-lg border p-1.5 text-sm transition-colors sm:p-2',
                      outside && 'opacity-30',
                      blocked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary/30 text-foreground',
                      past && !blocked && 'border-dashed bg-transparent text-muted-foreground',
                      isToday && 'ring-2 ring-ring ring-offset-2 ring-offset-card',
                    )}
                  >
                    <span className="tabular-nums">{format(day, 'd')}</span>
                  </div>
                )
              })}
            </div>

            {/* Identity is never colour alone. */}
            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-border bg-secondary/30" />
                {t.calendar.free}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-primary" />
                {t.calendar.blocked}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-dashed border-border" />
                {t.calendar.pastDay}
              </span>
              <span className="hidden italic sm:ml-auto sm:inline">{t.calendar.legendNote}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
