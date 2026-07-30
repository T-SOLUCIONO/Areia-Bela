'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { addDays, isWithinInterval, startOfDay } from 'date-fns'
import { CalendarDays, DollarSign, Images, Languages, LineChart } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { getBlockedDateRanges } from '@/lib/booking'
import { cms, type CMSPage, type PropertySettings } from '@/lib/cms-client'
import { HouseTimeline } from '@/components/admin/house-timeline'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'

const HORIZON_DAYS = 30

/** The twelve CMSPage slugs the guest site can render. */
const TOTAL_SECTIONS = 12

/**
 * Every figure on this page comes from the database. The revenue and occupancy
 * charts that used to live here plotted invented series: there is no Booking
 * data yet, so they are replaced by a stated gap rather than a plausible one.
 * They come back in Fase 6, against real bookings.
 */
export default function AdminDashboardPage() {
  const { language } = useAdminLanguage()
  const isEnglish = language === 'en'

  const [property, setProperty] = useState<PropertySettings | null>(null)
  const [pages, setPages] = useState<CMSPage[] | null>(null)
  const [photoCount, setPhotoCount] = useState<number | null>(null)
  const [freeNights, setFreeNights] = useState<number | null>(null)

  useEffect(() => {
    const today = startOfDay(new Date())
    const horizon = Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(today, i))

    // Four independent reads; a failure in one shouldn't blank the others, so
    // each tile falls back to its own dash.
    void cms.property().then(setProperty, () => setProperty(null))
    void cms.pages().then(setPages, () => setPages([]))
    void cms.gallery().then(
      (images) => setPhotoCount(images.filter((i) => i.published).length),
      () => setPhotoCount(null),
    )
    void getBlockedDateRanges().then(
      (ranges) =>
        setFreeNights(
          horizon.filter(
            (day) =>
              !ranges.some((r) =>
                isWithinInterval(day, { start: startOfDay(r.from), end: startOfDay(r.to) }),
              ),
          ).length,
        ),
      () => setFreeNights(null),
    )
  }, [])

  const baseRate = property?.priceRules.find((rule) => rule.type === 'LOW' && rule.active)
  // Sections with nothing written yet: the tile that used to count
  // untranslated ones lost its meaning when the site moved to one source
  // language, and this is the number a host can actually act on.
  const written = pages?.filter((page) => page.body.trim()).length ?? 0
  const unwritten = Math.max(0, TOTAL_SECTIONS - written)

  const stats = [
    {
      label: isEnglish
        ? `Nights free, next ${HORIZON_DAYS}`
        : `Noches libres, próximas ${HORIZON_DAYS}`,
      value: freeNights === null ? null : String(freeNights),
      icon: CalendarDays,
      href: '/admin/calendar',
    },
    {
      label: isEnglish ? 'Base rate' : 'Tarifa base',
      value: baseRate ? `$${Number(baseRate.nightlyRate).toFixed(0)}` : null,
      icon: DollarSign,
      href: '/admin/pricing',
    },
    {
      label: isEnglish ? 'Photos on the site' : 'Fotos en el sitio',
      value: photoCount === null ? null : String(photoCount),
      icon: Images,
      href: '/admin/content',
    },
    {
      label: isEnglish ? 'Sections still empty' : 'Secciones sin escribir',
      value: pages === null ? null : String(unwritten),
      icon: Languages,
      href: '/admin/content',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Leads with the one thing this business has that a hotel doesn't: a
          single unit, so time is the axis. */}
      <HouseTimeline />

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
                  {stat.value === null ? (
                    <Skeleton className="mt-1 h-8 w-16" />
                  ) : (
                    <p className="font-serif text-2xl tabular-nums text-foreground">{stat.value}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            {isEnglish ? 'Revenue and occupancy' : 'Ingresos y ocupación'}
          </CardTitle>
          <CardDescription>
            {isEnglish
              ? 'Measured from real bookings, once there are any to measure'
              : 'Se calculan con reservas reales, en cuanto haya alguna'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyMedia variant="icon">
              <LineChart aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{isEnglish ? 'No bookings yet' : 'Todavía no hay reservas'}</EmptyTitle>
            <EmptyDescription>
              {isEnglish
                ? 'Bookings are not stored yet, so there is nothing to chart. These figures arrive with the booking system, and they will be real when they do.'
                : 'Todavía no se guardan reservas, así que no hay nada que graficar. Estas cifras llegan con el sistema de reservas, y cuando lleguen serán reales.'}
            </EmptyDescription>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/admin/calendar">
                {isEnglish ? 'See availability' : 'Ver disponibilidad'}
              </Link>
            </Button>
          </Empty>
        </CardContent>
      </Card>
    </div>
  )
}
