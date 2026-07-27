'use client'

import { useState, useEffect } from 'react'
import {
  format,
  addDays,
  startOfWeek,
  addWeeks,
  isSameDay,
  isWithinInterval,
  parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Filter } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@areia-bela/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@areia-bela/ui/select'
import { Badge } from '@areia-bela/ui/badge'
import { cn } from '@/lib/utils'
import { mockRooms, mockReservations } from '@/lib/mock-data'
import { DemoDataNotice } from '@/components/admin/demo-data-notice'

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [viewType, setViewType] = useState<'week' | '2weeks' | 'month'>('2weeks')
  const [floorFilter, setFloorFilter] = useState<string>('all')

  useEffect(() => {
    setCurrentDate(new Date())
  }, [])

  if (!currentDate) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading calendar...</div>
      </div>
    )
  }

  const daysToShow = viewType === 'week' ? 7 : viewType === '2weeks' ? 14 : 30
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 })
  const dates = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i))

  const floors = [...new Set(mockRooms.map((r) => r.floor))].sort((a, b) => a - b)
  const filteredRooms =
    floorFilter === 'all' ? mockRooms : mockRooms.filter((r) => r.floor.toString() === floorFilter)

  const getReservationForRoomAndDate = (roomNumber: string, date: Date) => {
    return mockReservations.find((res) => {
      if (res.roomNumber !== roomNumber) return false
      const checkIn = parseISO(res.checkIn)
      const checkOut = parseISO(res.checkOut)
      return isWithinInterval(date, { start: checkIn, end: addDays(checkOut, -1) })
    })
  }

  const isCheckIn = (roomNumber: string, date: Date) => {
    return mockReservations.some((res) => {
      if (res.roomNumber !== roomNumber) return false
      return isSameDay(parseISO(res.checkIn), date)
    })
  }

  const isCheckOut = (roomNumber: string, date: Date) => {
    return mockReservations.some((res) => {
      if (res.roomNumber !== roomNumber) return false
      return isSameDay(parseISO(res.checkOut), date)
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-500'
      case 'checked-in':
        return 'bg-emerald-500'
      case 'pending':
        return 'bg-amber-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      <DemoDataNotice />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Block Dates
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addWeeks(currentDate, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold min-w-[200px] text-center">
                {format(startDate, 'MMM d')} -{' '}
                {format(addDays(startDate, daysToShow - 1), 'MMM d, yyyy')}
              </h2>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={viewType}
                onValueChange={(v: 'week' | '2weeks' | 'month') => setViewType(v)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">1 Week</SelectItem>
                  <SelectItem value="2weeks">2 Weeks</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
              <Select value={floorFilter} onValueChange={setFloorFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All Floors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Floors</SelectItem>
                  {floors.map((floor) => (
                    <SelectItem key={floor} value={floor.toString()}>
                      Floor {floor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-500" />
          <span>Checked In</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500" />
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-500" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-200" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-200" />
          <span>Blocked</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Header */}
            <div className="flex border-b sticky top-0 bg-card z-10">
              <div className="w-40 shrink-0 p-3 font-medium border-r bg-muted/50">Room</div>
              {dates.map((date) => (
                <div
                  key={date.toISOString()}
                  className={cn(
                    'flex-1 min-w-[60px] p-2 text-center border-r last:border-r-0',
                    isSameDay(date, new Date()) && 'bg-primary/10',
                    (date.getDay() === 0 || date.getDay() === 6) && 'bg-muted/30',
                  )}
                >
                  <div className="text-xs text-muted-foreground">{format(date, 'EEE')}</div>
                  <div
                    className={cn(
                      'text-sm font-medium',
                      isSameDay(date, new Date()) && 'text-primary',
                    )}
                  >
                    {format(date, 'd')}
                  </div>
                </div>
              ))}
            </div>

            {/* Rooms */}
            {filteredRooms.map((room) => (
              <div key={room.id} className="flex border-b last:border-b-0 hover:bg-muted/30">
                <div className="w-40 shrink-0 p-3 border-r bg-muted/20">
                  <div className="font-medium text-sm">{room.roomNumber}</div>
                  <div className="text-xs text-muted-foreground truncate">{room.name}</div>
                </div>
                {dates.map((date) => {
                  const reservation = getReservationForRoomAndDate(room.roomNumber, date)
                  const isCheckInDay = isCheckIn(room.roomNumber, date)
                  const isCheckOutDay = isCheckOut(room.roomNumber, date)

                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        'flex-1 min-w-[60px] p-1 border-r last:border-r-0 relative',
                        isSameDay(date, new Date()) && 'bg-primary/5',
                        (date.getDay() === 0 || date.getDay() === 6) && 'bg-muted/20',
                      )}
                    >
                      {reservation ? (
                        <div
                          className={cn(
                            'h-8 rounded-sm flex items-center justify-center text-xs text-white font-medium cursor-pointer hover:opacity-90 transition-opacity',
                            getStatusColor(reservation.status),
                            isCheckInDay && 'rounded-l-md ml-1',
                            isCheckOutDay && 'rounded-r-md mr-1',
                            !isCheckInDay && !isCheckOutDay && 'rounded-none',
                          )}
                          title={`${reservation.guestName} - ${reservation.status}`}
                        >
                          {isCheckInDay && (
                            <span className="truncate px-1">
                              {reservation.guestName.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="h-8 rounded-sm bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors" />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
