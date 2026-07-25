import {
  CalendarDays,
  DollarSign,
  Percent,
  BedDouble,
  ArrowUp,
  ArrowDown,
  Users,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { AdminHeader } from '@/components/admin/admin-header'
import { reservations, dailyStats, roomStats, channelStats } from '@/lib/mock-data'
import { RevenueChart } from '@/components/admin/charts/revenue-chart'
import { OccupancyChart } from '@/components/admin/charts/occupancy-chart'
import { ChannelChart } from '@/components/admin/charts/channel-chart'
import { RecentReservations } from '@/components/admin/recent-reservations'
import { UpcomingActivity } from '@/components/admin/upcoming-activity'

export default function AdminDashboardPage() {
  // Calculate stats
  const today = new Date().toISOString().split('T')[0]
  const todayStats = dailyStats[dailyStats.length - 1]
  const yesterdayStats = dailyStats[dailyStats.length - 2]

  const totalRevenue = dailyStats.reduce((sum, d) => sum + d.revenue, 0)
  const avgOccupancy = Math.round(
    dailyStats.reduce((sum, d) => sum + d.occupancyRate, 0) / dailyStats.length,
  )
  const avgNightlyRate = Math.round(
    dailyStats.reduce((sum, d) => sum + d.avgNightlyRate, 0) / dailyStats.length,
  )
  const totalReservations = reservations.filter((r) => r.status !== 'cancelled').length

  const todayCheckIns = reservations.filter(
    (r) => r.checkIn === today && r.status === 'confirmed',
  ).length
  const todayCheckOuts = reservations.filter(
    (r) => r.checkOut === today && r.status === 'checked-in',
  ).length

  const stats = [
    {
      title: 'Total Reservations',
      value: totalReservations.toString(),
      change: '+12%',
      trend: 'up',
      icon: CalendarDays,
    },
    {
      title: 'Monthly Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      change: '+8.2%',
      trend: 'up',
      icon: DollarSign,
    },
    {
      title: 'Avg. Occupancy',
      value: `${avgOccupancy}%`,
      change: '+5%',
      trend: 'up',
      icon: Percent,
    },
    {
      title: 'Avg. Nightly Rate',
      value: `$${avgNightlyRate}`,
      change: '-2%',
      trend: 'down',
      icon: BedDouble,
    },
  ]

  return (
    <>
      <AdminHeader title="Dashboard" description="Overview of your property's performance" />

      <main className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-semibold text-foreground mt-1">{stat.value}</p>
                    <div
                      className={`flex items-center gap-1 mt-1 text-sm ${
                        stat.trend === 'up' ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {stat.trend === 'up' ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                      <span>{stat.change} from last month</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Today's Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today&apos;s Check-ins</p>
                  <p className="text-3xl font-semibold text-foreground">{todayCheckIns}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today&apos;s Check-outs</p>
                  <p className="text-3xl font-semibold text-foreground">{todayCheckOuts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Daily revenue over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueChart data={dailyStats} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Occupancy Rate</CardTitle>
              <CardDescription>Daily occupancy percentage</CardDescription>
            </CardHeader>
            <CardContent>
              <OccupancyChart data={dailyStats} />
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Reservations</CardTitle>
                <CardDescription>Latest booking activity</CardDescription>
              </CardHeader>
              <CardContent>
                <RecentReservations reservations={reservations.slice(0, 5)} />
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Bookings by Channel</CardTitle>
                <CardDescription>Revenue distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ChannelChart data={channelStats} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  )
}
