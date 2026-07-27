'use client'

import { CalendarDays, DollarSign, Percent, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { dailyStats, reservations, channelStats } from '@/lib/mock-data'
import { RevenueChart } from '@/components/admin/charts/revenue-chart'
import { OccupancyChart } from '@/components/admin/charts/occupancy-chart'
import { ChannelChart } from '@/components/admin/charts/channel-chart'
import { HouseTimeline } from '@/components/admin/house-timeline'
import { DemoDataNotice } from '@/components/admin/demo-data-notice'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'

export default function AdminDashboardPage() {
  const { language } = useAdminLanguage()
  const isEnglish = language === 'en'

  const totalRevenue = dailyStats.reduce((sum, d) => sum + d.revenue, 0)
  const avgOccupancy = Math.round(
    dailyStats.reduce((sum, d) => sum + d.occupancyRate, 0) / dailyStats.length,
  )
  const avgNightlyRate = Math.round(
    dailyStats.reduce((sum, d) => sum + d.avgNightlyRate, 0) / dailyStats.length,
  )
  const totalReservations = reservations.filter((r) => r.status !== 'cancelled').length

  const stats = [
    {
      label: isEnglish ? 'Nights booked' : 'Noches reservadas',
      value: totalReservations.toString(),
      icon: CalendarDays,
    },
    {
      label: isEnglish ? 'Revenue, 30 days' : 'Ingresos, 30 días',
      value: `$${totalRevenue.toLocaleString('en-US')}`,
      icon: DollarSign,
    },
    {
      label: isEnglish ? 'Occupancy' : 'Ocupación',
      value: `${avgOccupancy}%`,
      icon: Percent,
    },
    {
      label: isEnglish ? 'Average night' : 'Noche promedio',
      value: `$${avgNightlyRate}`,
      icon: TrendingUp,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Leads with the one thing this business has that a hotel doesn't: a
          single unit, so time is the axis. Real data — the rest is not. */}
      <HouseTimeline />

      <DemoDataNotice />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">{stat.label}</p>
                {/* Serif for the figure: it is the one number per tile that
                    matters, and it ties the panel to the brand's display face. */}
                <p className="font-serif text-2xl text-foreground tabular-nums">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              {isEnglish ? 'Revenue' : 'Ingresos'}
            </CardTitle>
            <CardDescription>{isEnglish ? 'Last 30 days' : 'Últimos 30 días'}</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={dailyStats} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg">
              {isEnglish ? 'Occupancy' : 'Ocupación'}
            </CardTitle>
            <CardDescription>
              {isEnglish ? 'Share of nights booked' : 'Porcentaje de noches reservadas'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OccupancyChart data={dailyStats} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">
            {isEnglish ? 'Where bookings come from' : 'De dónde vienen las reservas'}
          </CardTitle>
          <CardDescription>
            {isEnglish ? 'Share of revenue by channel' : 'Ingresos por canal'}
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-md">
          <ChannelChart data={channelStats} />
        </CardContent>
      </Card>
    </div>
  )
}
