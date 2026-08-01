'use client'

import { useEffect, useState } from 'react'
import { addDays, format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@areia-bela/ui/dialog'
import { fill } from '@areia-bela/shared'
import { fetchNightRates, fetchStayLimits, getBlockedDateRanges } from '@/lib/booking'
import { translations, type Language } from '@/lib/i18n'
import { StayCalendar, type StayRange } from '@/components/public/stay-calendar'
import { GuestPicker, type GuestCounts } from '@/components/public/guest-picker'

interface DatesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  checkIn: string
  checkOut: string
  onSave: (checkIn: string, checkOut: string) => void
  language: Language
}

/**
 * Changing the dates without leaving the checkout.
 *
 * Loads its own availability rather than receiving it: the guest may have been
 * sitting on this page for twenty minutes, and the week they are about to move
 * to could have been booked in the meantime.
 */
export function EditDatesDialog({
  open,
  onOpenChange,
  checkIn,
  checkOut,
  onSave,
  language,
}: DatesProps) {
  const copy = translations[language].checkout
  const availability = translations[language].availability

  const [range, setRange] = useState<StayRange>({})
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set())
  const [blockedRanges, setBlockedRanges] = useState<Array<{ from: Date; to: Date }>>([])
  const [rates, setRates] = useState<Map<string, number>>(new Map())
  const [minNights, setMinNights] = useState(1)
  const [hoverDate, setHoverDate] = useState<Date | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return

    // Seeding a dialog from its props when it opens, not a render cascade:
    // this runs once per opening and nothing re-triggers it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRange({ from: new Date(`${checkIn}T00:00:00`), to: new Date(`${checkOut}T00:00:00`) })
    setLoading(true)

    const today = new Date()
    const from = format(today, 'yyyy-MM-dd')
    const to = format(addDays(today, 365), 'yyyy-MM-dd')

    void Promise.all([fetchNightRates(from, to), getBlockedDateRanges(), fetchStayLimits()]).then(
      ([nights, blocked, limits]) => {
        setRates(new Map(nights.map((night) => [night.date, night.rate])))
        setUnavailable(new Set(nights.filter((night) => !night.available).map((n) => n.date)))
        setBlockedRanges(blocked)
        setMinNights(limits.minNights)
        setLoading(false)
      },
    )
  }, [open, checkIn, checkOut])

  // Both ends, and a stay that is at least one night long.
  const ready = Boolean(range.from && range.to && range.to > range.from)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{copy.editDatesTitle}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#174d7a]" />
          </div>
        ) : (
          <StayCalendar
            value={range}
            onChange={setRange}
            unavailable={unavailable}
            blockedRanges={blockedRanges}
            rates={rates}
            minNights={minNights}
            language={language}
            hoverDate={hoverDate}
            onHoverDate={setHoverDate}
          />
        )}

        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setRange({})}
            className="text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
          >
            {availability.clearDates}
          </button>
          <Button
            variant="brand"
            size="lg"
            disabled={!ready}
            onClick={() => {
              if (!range.from || !range.to) return
              onSave(format(range.from, 'yyyy-MM-dd'), format(range.to, 'yyyy-MM-dd'))
              onOpenChange(false)
            }}
          >
            {copy.saveChange}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface GuestsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guests: GuestCounts
  maxGuests: number
  onSave: (guests: GuestCounts) => void
  onServiceAnimal: () => void
  language: Language
}

/** Changing the party without leaving the checkout. */
export function EditGuestsDialog({
  open,
  onOpenChange,
  guests,
  maxGuests,
  onSave,
  onServiceAnimal,
  language,
}: GuestsProps) {
  const copy = translations[language].checkout

  // Edited on a copy, so closing with the X leaves the booking as it was.
  const [draft, setDraft] = useState(guests)
  useEffect(() => {
    // Same reasoning as above: the draft is reset to the real party each time
    // the dialog opens, so an abandoned edit does not persist.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setDraft(guests)
  }, [open, guests])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{copy.editGuestsTitle}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {fill(copy.editGuestsLead, { count: String(maxGuests) })}
        </p>

        <GuestPicker
          value={draft}
          onChange={setDraft}
          maxGuests={maxGuests}
          onServiceAnimal={onServiceAnimal}
          language={language}
        />

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {copy.payCancel}
          </Button>
          <Button
            variant="brand"
            size="lg"
            onClick={() => {
              onSave(draft)
              onOpenChange(false)
            }}
          >
            {copy.saveChange}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
