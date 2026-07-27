'use client'

import { useState } from 'react'
import {
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  Bed,
  Users,
  BarChart3,
  PieChart,
  LineChart,
} from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@areia-bela/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@areia-bela/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@areia-bela/ui/table'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts'
import { DemoDataNotice } from '@/components/admin/demo-data-notice'

const revenueData = [
  { month: 'Jan', revenue: 45000, occupancy: 65 },
  { month: 'Feb', revenue: 52000, occupancy: 72 },
  { month: 'Mar', revenue: 48000, occupancy: 68 },
  { month: 'Apr', revenue: 61000, occupancy: 78 },
  { month: 'May', revenue: 55000, occupancy: 74 },
  { month: 'Jun', revenue: 72000, occupancy: 85 },
  { month: 'Jul', revenue: 85000, occupancy: 92 },
  { month: 'Aug', revenue: 82000, occupancy: 89 },
  { month: 'Sep', revenue: 65000, occupancy: 76 },
  { month: 'Oct', revenue: 58000, occupancy: 71 },
  { month: 'Nov', revenue: 51000, occupancy: 67 },
  { month: 'Dec', revenue: 78000, occupancy: 88 },
]

const channelData = [
  { name: 'Direct', value: 35, color: 'var(--chart-1)' },
  { name: 'Booking.com', value: 28, color: 'var(--chart-2)' },
  { name: 'Expedia', value: 18, color: 'var(--chart-3)' },
  { name: 'Airbnb', value: 12, color: 'var(--chart-4)' },
  { name: 'Other', value: 7, color: 'var(--chart-5)' },
]

const roomPerformance = [
  { room: 'Ocean View Suite', bookings: 124, revenue: 89500, adr: 722, occupancy: 87 },
  { room: 'Deluxe King Room', bookings: 186, revenue: 74400, adr: 400, occupancy: 92 },
  { room: 'Presidential Suite', bookings: 45, revenue: 112500, adr: 2500, occupancy: 65 },
  { room: 'Standard Double', bookings: 234, revenue: 58500, adr: 250, occupancy: 95 },
  { room: 'Garden View Room', bookings: 156, revenue: 54600, adr: 350, occupancy: 88 },
]

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('this-month')
  const [reportType, setReportType] = useState('overview')

  return (
    <div className="space-y-6">
      <DemoDataNotice />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="this-quarter">This Quarter</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$752,000</div>
            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +12.5% vs last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Daily Rate
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$485</div>
            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +8.2% vs last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Occupancy Rate
            </CardTitle>
            <Bed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78.5%</div>
            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +5.3% vs last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">RevPAR</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$380</div>
            <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +15.2% vs last period
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="rooms">Room Performance</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
              <CardDescription>Monthly revenue performance for the year</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `$${value / 1000}k`} />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Occupancy Tab */}
        <TabsContent value="occupancy" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Occupancy Trends</CardTitle>
              <CardDescription>Monthly occupancy rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `${value}%`} />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Occupancy']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="occupancy"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channels Tab */}
        <TabsContent value="channels" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Booking Distribution</CardTitle>
                <CardDescription>Bookings by channel source</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={channelData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {channelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, 'Share']}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {channelData.map((channel) => (
                    <div key={channel.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: channel.color }}
                      />
                      <span className="text-sm">
                        {channel.name} ({channel.value}%)
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Channel Performance</CardTitle>
                <CardDescription>Revenue and commission by channel</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Direct</TableCell>
                      <TableCell className="text-right">245</TableCell>
                      <TableCell className="text-right">$263,200</TableCell>
                      <TableCell className="text-right text-emerald-600">$0</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Booking.com</TableCell>
                      <TableCell className="text-right">196</TableCell>
                      <TableCell className="text-right">$210,560</TableCell>
                      <TableCell className="text-right text-red-600">-$31,584</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Expedia</TableCell>
                      <TableCell className="text-right">126</TableCell>
                      <TableCell className="text-right">$135,360</TableCell>
                      <TableCell className="text-right text-red-600">-$20,304</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Airbnb</TableCell>
                      <TableCell className="text-right">84</TableCell>
                      <TableCell className="text-right">$90,240</TableCell>
                      <TableCell className="text-right text-red-600">-$2,707</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Room Performance Tab */}
        <TabsContent value="rooms" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Room Type Performance</CardTitle>
              <CardDescription>Detailed metrics by room category</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room Type</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">ADR</TableHead>
                    <TableHead className="text-right">Occupancy</TableHead>
                    <TableHead className="text-right">RevPAR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomPerformance.map((room) => (
                    <TableRow key={room.room}>
                      <TableCell className="font-medium">{room.room}</TableCell>
                      <TableCell className="text-right">{room.bookings}</TableCell>
                      <TableCell className="text-right">${room.revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${room.adr}</TableCell>
                      <TableCell className="text-right">{room.occupancy}%</TableCell>
                      <TableCell className="text-right">
                        ${Math.round(room.adr * (room.occupancy / 100))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
