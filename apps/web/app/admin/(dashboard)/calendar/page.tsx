'use client'

import { useCallback, useEffect, useState } from 'react'
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
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { enUS, es as esLocale } from 'date-fns/locale'
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@areia-bela/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@areia-bela/ui/dialog'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { apiFetch, ApiError } from '@/lib/api-client'
import { PROPERTY_SLUG } from '@/lib/property-data'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'
import { cn } from '@/lib/utils'

interface BlockedRange {
  id: string
  startDate: string
  endDate: string
  reason?: string
}

interface BookedRange {
  reference: string
  checkIn: string
  checkOut: string
  guestName: string
  status: string
}

const iso = (day: Date) => format(day, 'yyyy-MM-dd')

/**
 * One reservable unit, so availability is a single line through time — not the
 * rooms × dates matrix this page used to be.
 *
 * Two things take a night off the market and they are not the same: a booking,
 * which is money and a guest arriving, and a block, which is the host's own
 * decision. The calendar shows which is which, because "unavailable" alone
 * does not tell you whether you may do anything about it.
 */
export default function CalendarPage() {
  const { language, t } = useAdminLanguage()
  const locale = language === 'en' ? enUS : esLocale
  const copy = t.calendar

  const [monthOffset, setMonthOffset] = useState(0)
  const [blocked, setBlocked] = useState<BlockedRange[]>([])
  const [booked, setBooked] = useState<BookedRange[]>([])
  const [loading, setLoading] = useState(true)

  // Two clicks: first night, last night. A drag would be nicer with a mouse
  // and unusable on the phone the host actually carries.
  const [selecting, setSelecting] = useState(false)
  const [from, setFrom] = useState<Date | null>(null)
  const [to, setTo] = useState<Date | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [unblocking, setUnblocking] = useState<BlockedRange | null>(null)

  const load = useCallback(async () => {
    try {
      const [ranges, bookings] = await Promise.all([
        apiFetch<BlockedRange[]>(`/properties/${PROPERTY_SLUG}/blocked-dates`),
        apiFetch<BookedRange[]>('/bookings'),
      ])
      setBlocked(ranges)
      setBooked(bookings.filter((b) => b.status !== 'CANCELLED'))
    } catch {
      toast.error(copy.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [copy.loadFailed])

  useEffect(() => {
    // The rule cannot see that every setState in `load` happens after an
    // await, so none of them are the synchronous cascade it warns about.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const today = startOfDay(new Date())
  const month = addMonths(startOfMonth(today), monthOffset)

  // Padded to whole weeks so the columns always line up. Not memoized: it is
  // 42 dates, and a manual useMemo here stops the React Compiler optimizing
  // the component at all.
  const grid = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })

  const blockFor = (day: Date) =>
    blocked.find((range) =>
      isWithinInterval(day, {
        start: startOfDay(parseISO(range.startDate)),
        end: startOfDay(parseISO(range.endDate)),
      }),
    )

  // checkOut is a departure morning, not a night, so it is excluded — the same
  // rule the exclusion constraint uses.
  const bookingFor = (day: Date) =>
    booked.find(
      (b) =>
        !isBefore(day, startOfDay(parseISO(b.checkIn))) &&
        isBefore(day, startOfDay(parseISO(b.checkOut))),
    )

  const inSelection = (day: Date) => {
    if (!from) return false
    const end = to ?? from
    const [start, finish] = isBefore(end, from) ? [end, from] : [from, end]
    return isWithinInterval(day, { start, end: finish })
  }

  const handleDayClick = (day: Date) => {
    const block = blockFor(day)

    if (!selecting) {
      // Outside selection mode, a click on a blocked day is a request to free
      // it. Everything else is inert: bookings are cancelled from Reservations,
      // where the guest and the refund are in view.
      if (block) setUnblocking(block)
      return
    }

    if (isBefore(day, today)) {
      toast.error(copy.pastNotBlockable)
      return
    }
    if (bookingFor(day) || block) {
      toast.error(copy.blockClash)
      return
    }

    if (!from || to) {
      setFrom(day)
      setTo(null)
    } else {
      setTo(day)
    }
  }

  const resetSelection = () => {
    setSelecting(false)
    setFrom(null)
    setTo(null)
    setReason('')
  }

  const submitBlock = async () => {
    if (!from) return
    const end = to ?? from
    const [start, finish] = isBefore(end, from) ? [end, from] : [from, end]

    setBusy(true)
    try {
      await apiFetch<BlockedRange>(`/properties/${PROPERTY_SLUG}/blocked-dates`, {
        method: 'POST',
        body: JSON.stringify({
          startDate: iso(start),
          endDate: iso(finish),
          reason: reason.trim() || undefined,
        }),
      })
      toast.success(copy.blocked_ok)
      resetSelection()
      await load()
    } catch (err) {
      // 409 is the one the host can act on: there is a booking in the way.
      toast.error(
        err instanceof ApiError && err.status === 409 ? copy.blockClash : copy.blockFailed,
      )
    } finally {
      setBusy(false)
    }
  }

  const submitUnblock = async () => {
    if (!unblocking) return
    setBusy(true)
    try {
      await apiFetch<void>(`/properties/blocked-dates/${unblocking.id}`, { method: 'DELETE' })
      toast.success(copy.unblocked_ok)
      setUnblocking(null)
      await load()
    } catch {
      toast.error(copy.unblockFailed)
    } finally {
      setBusy(false)
    }
  }

  const monthDays = grid.filter((d) => isSameMonth(d, month))
  const takenCount = monthDays.filter((d) => blockFor(d) || bookingFor(d)).length
  const freeCount = monthDays.length - takenCount

  const weekdayLabels = eachDayOfInterval({
    start: startOfWeek(today, { weekStartsOn: 1 }),
    end: endOfWeek(today, { weekStartsOn: 1 }),
  }).map((day) => format(day, 'EEEEEE', { locale }))

  const dayTitle = (day: Date) => {
    const booking = bookingFor(day)
    if (booking) return fill(copy.bookedBy, { name: booking.guestName })
    const block = blockFor(day)
    if (block) {
      return block.reason ? fill(copy.blockedFor, { reason: block.reason }) : copy.blockedNoReason
    }
    return format(day, 'PPPP', { locale })
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="font-serif text-xl capitalize">
              {format(month, 'LLLL yyyy', { locale })}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? t.common.loading
                : `${fill(copy.nightsFree, { count: String(freeCount) })} · ${fill(
                    copy.nightsBlocked,
                    { count: String(takenCount) },
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
              {copy.today}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={language === 'en' ? 'Next month' : 'Mes siguiente'}
              onClick={() => setMonthOffset((o) => o + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {selecting ? (
              <Button variant="outline" size="sm" onClick={resetSelection}>
                <X className="h-4 w-4" />
                {copy.cancelSelection}
              </Button>
            ) : (
              <Button variant="brand" size="sm" onClick={() => setSelecting(true)}>
                <CalendarPlus className="h-4 w-4" />
                {copy.blockDates}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {selecting && (
            <p className="mb-4 rounded-[12px] bg-primary/10 px-4 py-3 text-sm text-foreground">
              {!from ? copy.selectStart : !to ? copy.selectEnd : null}
              {from && to && (
                <span className="font-medium">
                  {fill(copy.selectedRange, {
                    from: format(isBefore(to, from) ? to : from, 'd MMM', { locale }),
                    to: format(isBefore(to, from) ? from : to, 'd MMM', { locale }),
                  })}
                </span>
              )}
            </p>
          )}

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
                  const booking = bookingFor(day)
                  const block = blockFor(day)
                  const selected = inSelection(day)
                  const past = isBefore(day, today)
                  const isToday = isSameDay(day, today)
                  const clickable = selecting ? !booking && !block && !past : Boolean(block)

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={!clickable}
                      onClick={() => handleDayClick(day)}
                      title={dayTitle(day)}
                      className={cn(
                        'flex aspect-square flex-col items-end justify-between rounded-lg border p-1.5 text-sm transition-colors sm:p-2',
                        outside && 'opacity-30',
                        // Booked wins over blocked: if both somehow apply, the
                        // one with a guest attached is what matters.
                        booking
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : block
                            ? 'border-primary bg-primary text-primary-foreground'
                            : selected
                              ? 'border-primary bg-primary/25 text-foreground'
                              : 'border-border bg-secondary/30 text-foreground',
                        past &&
                          !booking &&
                          !block &&
                          'border-dashed bg-transparent text-muted-foreground',
                        isToday && 'ring-2 ring-ring ring-offset-2 ring-offset-card',
                        clickable && 'cursor-pointer hover:opacity-80',
                      )}
                    >
                      <span className="tabular-nums">{format(day, 'd')}</span>
                      {booking && (
                        <span className="w-full truncate text-left text-[10px] leading-none opacity-90">
                          {booking.guestName.split(' ')[0]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Identity is never colour alone. */}
              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded border border-border bg-secondary/30" />
                  {copy.free}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-emerald-600" />
                  {copy.booked}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-primary" />
                  {copy.blocked}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded border border-dashed border-border" />
                  {copy.pastDay}
                </span>
                <span className="hidden italic sm:ml-auto sm:inline">{copy.legendNote}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Asks for a reason once the range is picked. The host reads it months
          later and "why is October closed?" should have an answer. */}
      <Dialog open={selecting && from !== null && to !== null} onOpenChange={() => setTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.blockDates}</DialogTitle>
            <DialogDescription>
              {from &&
                to &&
                fill(copy.selectedRange, {
                  from: format(isBefore(to, from) ? to : from, 'PPP', { locale }),
                  to: format(isBefore(to, from) ? from : to, 'PPP', { locale }),
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="block-reason">{copy.blockReason}</Label>
            <Input
              id="block-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={copy.blockReasonHint}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTo(null)} disabled={busy}>
              {copy.cancelSelection}
            </Button>
            <Button variant="brand" onClick={() => void submitBlock()} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? copy.blocking : copy.blockConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unblocking !== null} onOpenChange={(open) => !open && setUnblocking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.unblockTitle}</DialogTitle>
            <DialogDescription>
              {unblocking &&
                `${fill(copy.selectedRange, {
                  from: format(parseISO(unblocking.startDate), 'PPP', { locale }),
                  to: format(parseISO(unblocking.endDate), 'PPP', { locale }),
                })} — ${copy.unblockLead}`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUnblocking(null)} disabled={busy}>
              {copy.cancelSelection}
            </Button>
            <Button variant="destructive" onClick={() => void submitUnblock()} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {copy.unblock}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
