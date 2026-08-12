'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  addDays,
  differenceInCalendarDays,
  format,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfDay,
} from 'date-fns'
import { enUS, es as esLocale } from 'date-fns/locale'
import {
  ArrowRight,
  CalendarDays,
  Clock,
  DollarSign,
  PawPrint,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { apiFetch } from '@/lib/api-client'
import { getBlockedDateRanges } from '@/lib/booking'
import { HouseTimeline } from '@/components/admin/house-timeline'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'

const HORIZON_DAYS = 30

interface Reservation {
  id: string
  reference: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  pets: number
  total: number
  status: string
  expiresAt: string | null
  guestName: string
}

/**
 * What the host needs on opening the panel, in the order she needs it: who is
 * arriving, how full the month is, what has been paid.
 *
 * Every figure comes from real bookings. The revenue and occupancy charts that
 * used to sit here plotted invented series and were replaced by a stated gap
 * until there was something true to show; this is that gap filled in.
 */
export default function AdminDashboardPage() {
  const { language, t } = useAdminLanguage()
  const copy = t.dashboard
  const locale = language === 'en' ? enUS : esLocale

  const [bookings, setBookings] = useState<Reservation[] | null>(null)
  const [blockedNights, setBlockedNights] = useState<number | null>(null)

  useEffect(() => {
    // Two independent reads; a failure in one should not blank the other.
    void apiFetch<Reservation[]>('/bookings').then(setBookings, () => setBookings([]))

    const start = startOfDay(new Date())
    const horizon = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(start, i))
    void getBlockedDateRanges().then(
      (ranges) =>
        setBlockedNights(
          horizon.filter((day) =>
            ranges.some((r) =>
              isWithinInterval(day, { start: startOfDay(r.from), end: startOfDay(r.to) }),
            ),
          ).length,
        ),
      () => setBlockedNights(null),
    )
  }, [])

  const today = startOfDay(new Date())
  const horizonEnd = addDays(today, HORIZON_DAYS)

  const live = (bookings ?? []).filter((b) => b.status !== 'CANCELLED')
  const paid = live.filter((b) => b.status !== 'PENDING')

  const upcoming = paid
    .filter((b) => !isBefore(parseISO(b.checkOut), today))
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))

  const next = upcoming[0]
  const daysToNext = next ? differenceInCalendarDays(parseISO(next.checkIn), today) : null

  // Nights of the coming month that already belong to someone. Counted per
  // night rather than per booking: one that straddles the edge only occupies
  // the part inside the window.
  const bookedNights = paid.reduce((count, booking) => {
    const from = parseISO(booking.checkIn)
    const to = parseISO(booking.checkOut)
    let nights = 0
    for (let day = from; isBefore(day, to); day = addDays(day, 1)) {
      if (!isBefore(day, today) && isBefore(day, horizonEnd)) nights += 1
    }
    return count + nights
  }, 0)

  const revenueAhead = paid
    .filter((b) => {
      const checkIn = parseISO(b.checkIn)
      return !isBefore(checkIn, today) && isBefore(checkIn, horizonEnd)
    })
    .reduce((sum, b) => sum + b.total, 0)

  const collected = paid
    .filter((b) => isBefore(parseISO(b.checkIn), today))
    .reduce((sum, b) => sum + b.total, 0)

  // Holds in flight: money that is not hers yet, and the one number here that
  // can change in the next twenty minutes.
  const holds = live.filter(
    (b) => b.status === 'PENDING' && b.expiresAt && new Date(b.expiresAt) > new Date(),
  )

  const loading = bookings === null

  const stats = [
    {
      label: copy.occupancy,
      value: String(bookedNights),
      hint: fill(copy.ofNights, { total: String(HORIZON_DAYS) }),
      icon: CalendarDays,
      href: '/admin/calendar',
    },
    {
      label: copy.confirmedRevenue,
      value: `$${revenueAhead.toLocaleString()}`,
      hint: undefined,
      icon: TrendingUp,
      href: '/admin/reservations',
    },
    {
      label: copy.thisYear,
      value: `$${collected.toLocaleString()}`,
      hint: undefined,
      icon: DollarSign,
      href: '/admin/reservations',
    },
    {
      label: copy.awaitingPayment,
      value: holds.length ? String(holds.length) : '—',
      hint: holds.length ? undefined : copy.awaitingNone,
      icon: Clock,
      href: '/admin/reservations',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Leads with the one thing this business has that a hotel doesn't: a
          single unit, so time is the axis. */}
      <HouseTimeline />

      {/* The next arrival gets a card to itself. It is the question the host
          opens this page to answer, and a tile among four buries it. */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary">
              <UserCheck className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {copy.nextArrival}
              </p>
              {loading ? (
                <Skeleton className="mt-2 h-8 w-56" />
              ) : next ? (
                <>
                  <p className="font-serif text-2xl text-foreground">{next.guestName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {format(parseISO(next.checkIn), 'EEEE d MMMM', { locale })} ·{' '}
                    {fill(copy.staying, {
                      nights: String(next.nights),
                      guests: String(next.guests),
                    })}
                    {next.pets > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <PawPrint className="h-3.5 w-3.5" />
                        {next.pets}
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-serif text-2xl text-foreground">{copy.nobodyBooked}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{copy.nobodyBookedLead}</p>
                </>
              )}
            </div>
          </div>

          {!loading && next && daysToNext !== null && (
            <div className="shrink-0 rounded-[20px] border border-border bg-secondary px-6 py-4 text-center shadow-sm">
              <p className="font-serif text-3xl tabular-nums text-foreground">
                {daysToNext === 0 ? '·' : daysToNext}
              </p>
              <p className="mt-0.5 text-xs text-primary/80">
                {daysToNext === 0
                  ? copy.arrivesToday
                  : daysToNext === 1
                    ? copy.arrivesTomorrow
                    : fill(copy.arrivesIn, { count: String(daysToNext) })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="group rounded-xl">
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted-foreground">{stat.label}</p>
                  {/* Serif for the figure: it is the one number per tile that
                      matters, and it ties the panel to the brand's display face. */}
                  {loading ? (
                    <Skeleton className="mt-1 h-8 w-16" />
                  ) : (
                    <p className="font-serif text-2xl tabular-nums text-foreground">{stat.value}</p>
                  )}
                  {stat.hint && !loading && (
                    <p className="text-xs text-muted-foreground">{stat.hint}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Only shown when there is something to do about it. An empty "needs
          attention" panel trains people to stop reading it. */}
      {!loading && (holds.length > 0 || (blockedNights ?? 0) > 0) && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/50">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base text-amber-900">
              {copy.needsAttention}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-900/90">
            {holds.map((hold) => (
              <p key={hold.id}>
                {fill(copy.holdExpiring, {
                  name: hold.guestName,
                  dates: `${format(parseISO(hold.checkIn), 'd MMM', { locale })} – ${format(
                    parseISO(hold.checkOut),
                    'd MMM',
                    { locale },
                  )}`,
                  time: hold.expiresAt ? format(parseISO(hold.expiresAt), 'HH:mm') : '',
                })}
              </p>
            ))}
            {(blockedNights ?? 0) > 0 && (
              <p>{fill(copy.blockedAhead, { count: String(blockedNights) })}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="font-serif text-lg">{copy.upcomingTitle}</CardTitle>
            <CardDescription>{copy.upcomingLead}</CardDescription>
          </div>
          {upcoming.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/reservations">
                {copy.viewAll}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Users aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{copy.noUpcoming}</EmptyTitle>
              <EmptyDescription>{copy.noUpcomingLead}</EmptyDescription>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/admin/calendar">{t.calendar.blockDates}</Link>
              </Button>
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.slice(0, 5).map((booking) => (
                <li key={booking.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{booking.guestName}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(booking.checkIn), 'd MMM', { locale })} –{' '}
                      {format(parseISO(booking.checkOut), 'd MMM', { locale })} ·{' '}
                      {fill(copy.staying, {
                        nights: String(booking.nights),
                        guests: String(booking.guests),
                      })}
                    </p>
                  </div>
                  <p className="shrink-0 font-serif text-lg tabular-nums text-foreground">
                    ${booking.total.toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
