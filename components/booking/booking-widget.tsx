'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays, differenceInDays } from 'date-fns'
import { Calendar, Users, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/components/language-provider'

interface BookingWidgetProps {
  variant?: 'hero' | 'compact' | 'inline' | 'sidebar'
  className?: string
}

export function BookingWidget({ variant = 'hero', className }: BookingWidgetProps) {
  const router = useRouter()
  const { language } = useLanguage()
  const isEnglish = language === 'en'
  const [checkIn, setCheckIn] = useState<Date | undefined>(undefined)
  const [checkOut, setCheckOut] = useState<Date | undefined>(undefined)
  const [guests, setGuests] = useState('2')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const today = new Date()
    setCheckIn(addDays(today, 1))
    setCheckOut(addDays(today, 3))
  }, [])

  const nights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0

  const handleSearch = () => {
    const params = new URLSearchParams({
      checkIn: checkIn ? format(checkIn, 'yyyy-MM-dd') : '',
      checkOut: checkOut ? format(checkOut, 'yyyy-MM-dd') : '',
      guests,
    })
    router.push(`/rooms/1489399156507737323?${params.toString()}`)
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto justify-start">
              <Calendar className="mr-2 h-4 w-4" />
              {mounted && checkIn ? format(checkIn, 'MMM d') : isEnglish ? 'Check-in' : 'Llegada'} - {mounted && checkOut ? format(checkOut, 'MMM d') : isEnglish ? 'Check-out' : 'Salida'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={{ from: checkIn, to: checkOut }}
              onSelect={(range) => {
                setCheckIn(range?.from)
                setCheckOut(range?.to)
              }}
              numberOfMonths={2}
              disabled={{ before: new Date() }}
            />
          </PopoverContent>
        </Popover>
        <Select value={guests} onValueChange={setGuests}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <Users className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <SelectItem key={n} value={n.toString()}>
                {n} {n === 1 ? (isEnglish ? 'Guest' : 'Huésped') : (isEnglish ? 'Guests' : 'Huéspedes')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleSearch}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  if (variant === 'sidebar') {
    return (
      <div className={cn('flex flex-col w-full', className)}>
        <div className="border border-border rounded-xl overflow-hidden mb-4">
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex border-b border-border cursor-pointer">
                <div className="flex-1 p-3 text-left hover:bg-muted/50 transition-colors border-r border-border">
                  <div className="text-[10px] uppercase font-bold text-foreground">{isEnglish ? 'Check-in' : 'Llegada'}</div>
                  <div className="text-sm text-foreground/80 mt-0.5 truncate">
                    {mounted && checkIn ? format(checkIn, 'dd/MM/yyyy') : (isEnglish ? 'Add date' : 'Añadir fecha')}
                  </div>
                </div>
                <div className="flex-1 p-3 text-left hover:bg-muted/50 transition-colors">
                  <div className="text-[10px] uppercase font-bold text-foreground">{isEnglish ? 'Check-out' : 'Salida'}</div>
                  <div className="text-sm text-foreground/80 mt-0.5 truncate">
                    {mounted && checkOut ? format(checkOut, 'dd/MM/yyyy') : (isEnglish ? 'Add date' : 'Añadir fecha')}
                  </div>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="range"
                selected={{ from: checkIn, to: checkOut }}
                onSelect={(range) => {
                  setCheckIn(range?.from)
                  setCheckOut(range?.to)
                }}
                numberOfMonths={2}
                disabled={{ before: new Date() }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Select value={guests} onValueChange={setGuests}>
            <SelectTrigger className="w-full border-0 focus:ring-0 rounded-none h-auto p-3 hover:bg-muted/50 transition-colors">
              <div className="text-left flex-1">
                <div className="text-[10px] uppercase font-bold text-foreground">{isEnglish ? 'Guests' : 'Huéspedes'}</div>
                <div className="text-sm text-foreground/80 mt-0.5 truncate">
                  {guests} {guests === '1' ? (isEnglish ? 'guest' : 'huésped') : (isEnglish ? 'guests' : 'huéspedes')}
                </div>
              </div>
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <SelectItem key={n} value={n.toString()}>
                  {n} {n === 1 ? (isEnglish ? 'Guest' : 'Huésped') : (isEnglish ? 'Guests' : 'Huéspedes')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSearch} className="w-full text-base font-semibold py-3 bg-[#E31C5F] hover:bg-[#D70466] text-white rounded-lg h-auto">
          Reservar
        </Button>
      </div>
    )
  }

  return (
    <div className={cn(
      'bg-card rounded-xl shadow-lg border border-border p-6',
      variant === 'hero' && 'max-w-4xl mx-auto',
      className
    )}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Check-in */}
        <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {isEnglish ? 'Check-in' : 'Llegada'}
            </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal h-12',
                  !checkIn && 'text-muted-foreground'
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {mounted && checkIn ? format(checkIn, 'EEE, MMM d') : (isEnglish ? 'Select date' : 'Seleccionar fecha')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={checkIn}
                onSelect={(date) => {
                  setCheckIn(date)
                  if (date && checkOut && date >= checkOut) {
                    setCheckOut(addDays(date, 1))
                  }
                }}
                disabled={{ before: new Date() }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Check-out */}
        <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {isEnglish ? 'Check-out' : 'Salida'}
            </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal h-12',
                  !checkOut && 'text-muted-foreground'
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {mounted && checkOut ? format(checkOut, 'EEE, MMM d') : (isEnglish ? 'Select date' : 'Seleccionar fecha')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={checkOut}
                onSelect={setCheckOut}
                disabled={{ before: checkIn || new Date() }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Guests */}
        <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {isEnglish ? 'Guests' : 'Huéspedes'}
          </label>
          <Select value={guests} onValueChange={setGuests}>
            <SelectTrigger className="h-12">
              <div className="flex items-center">
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <SelectItem key={n} value={n.toString()}>
                  {n} {n === 1 ? (isEnglish ? 'Guest' : 'Huésped') : (isEnglish ? 'Guests' : 'Huéspedes')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search Button */}
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground hidden md:block">
            &nbsp;
          </label>
            <Button className="w-full h-12 text-base" onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
            {isEnglish ? 'Check Availability' : 'Ver disponibilidad'}
            </Button>
        </div>
      </div>

      {mounted && nights > 0 && (
        <p className="text-sm text-muted-foreground mt-4 text-center">
          {nights} {nights === 1 ? (isEnglish ? 'night' : 'noche') : (isEnglish ? 'nights' : 'noches')} {isEnglish ? 'selected' : 'seleccionadas'}
        </p>
      )}
    </div>
  )
}
