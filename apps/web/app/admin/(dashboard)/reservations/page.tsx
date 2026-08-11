'use client'

import { useEffect, useState } from 'react'
import { format, isBefore, parseISO, startOfToday } from 'date-fns'
import { enUS, es as esLocale } from 'date-fns/locale'
import {
  CalendarDays,
  ClipboardList,
  Loader2,
  Mail,
  PawPrint,
  Phone,
  Plus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent } from '@areia-bela/ui/card'
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { apiFetch } from '@/lib/api-client'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { adminCopy, fill } from '@/lib/admin-i18n'
import { RefundDialog } from '@/components/admin/refund-dialog'
import { EditBookingDialog } from '@/components/admin/edit-booking-dialog'
import { NewBookingDialog } from '@/components/admin/new-booking-dialog'
import { Pagination, usePagination } from '@/components/admin/pagination'
import { cn } from '@/lib/utils'

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT'

interface Reservation {
  id: string
  reference: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  pets: number
  total: number
  status: BookingStatus
  source: 'WEBSITE' | 'PANEL'
  expiresAt: string | null
  paidAt: string | null
  refunded: number
  guestName: string
  guestEmail: string
  guestPhone: string
  extras: string[]
  specialRequests: string | null
  createdAt: string
}

/** Colour repeats what the label already says; it never carries meaning alone. */
const STATUS_STYLE: Record<BookingStatus, string> = {
  CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING: 'bg-amber-50 text-amber-800 ring-amber-200',
  CANCELLED: 'bg-slate-100 text-muted-foreground ring-slate-200',
  CHECKED_IN: 'bg-sky-50 text-sky-700 ring-sky-200',
  CHECKED_OUT: 'bg-slate-50 text-muted-foreground ring-slate-200',
}

export default function ReservationsPage() {
  const { language } = useAdminLanguage()
  const copy = adminCopy[language].reservations
  const dateLocale = language === 'en' ? enUS : esLocale

  const [reservations, setReservations] = useState<Reservation[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [cancelling, setCancelling] = useState<Reservation | null>(null)
  const [editing, setEditing] = useState<Reservation | null>(null)
  const [refunding, setRefunding] = useState<Reservation | null>(null)
  const [creating, setCreating] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      setReservations(await apiFetch<Reservation[]>('/bookings'))
      setFailed(false)
    } catch {
      // Told apart from "no bookings" on purpose: an empty list and a dead API
      // look identical otherwise, and only one of them needs someone to act.
      setFailed(true)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // Above every early return: a hook cannot be skipped on one render and run
  // on the next.
  //
  // Only the past is paged. What is coming is what the host acts on, and it is
  // bounded by how far ahead one house can be booked; the history is not.
  const today = startOfToday()
  const pagedPast = usePagination(
    (reservations ?? []).filter((row) => isBefore(parseISO(row.checkOut), today)),
  )

  const statusLabel = (status: BookingStatus) =>
    ({
      CONFIRMED: copy.confirmed,
      PENDING: copy.pending,
      CANCELLED: copy.cancelled,
      CHECKED_IN: copy.checkedIn,
      CHECKED_OUT: copy.checkedOut,
    })[status]

  const confirmCancel = async () => {
    if (!cancelling) return
    setBusy(true)
    try {
      await apiFetch<void>(`/bookings/${cancelling.id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      toast.success(copy.cancelled_ok)
      // Straight into the refund, while the host is still thinking about this
      // booking. Cancelling a paid stay and settling the money are one decision
      // made in two steps, not two errands.
      const paid = cancelling.paidAt !== null && cancelling.refunded < cancelling.total
      setCancelling(null)
      setReason('')
      await load()
      if (paid) setRefunding(cancelling)
    } catch {
      toast.error(copy.cancelFailed)
    } finally {
      setBusy(false)
    }
  }

  if (failed) {
    return (
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardList />
          </EmptyMedia>
          <EmptyTitle>{copy.loadFailed}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  if (!reservations) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!reservations.length) {
    return (
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDays />
          </EmptyMedia>
          <EmptyTitle>{copy.empty}</EmptyTitle>
          <EmptyDescription>{copy.emptyLead}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const upcoming = reservations.filter((row) => !isBefore(parseISO(row.checkOut), today))
  const past = reservations.filter((row) => isBefore(parseISO(row.checkOut), today))

  const renderRow = (row: Reservation) => (
    <Card key={row.id} className={cn(row.status === 'CANCELLED' && 'opacity-60')}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold tracking-wide text-foreground">
              {row.reference}
            </span>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                STATUS_STYLE[row.status],
              )}
            >
              {statusLabel(row.status)}
            </span>
            {/* A stay taken by phone will never appear in Stripe's ledger,
                  so the payments screen would look like it lost the money. */}
            {row.source === 'PANEL' && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground ring-1 ring-inset ring-border">
                {copy.sourcePANEL}
              </span>
            )}
            {row.status === 'PENDING' && row.expiresAt && (
              <span className="text-xs text-muted-foreground">
                {fill(copy.holdExpires, { time: format(parseISO(row.expiresAt), 'HH:mm') })}
              </span>
            )}
          </div>

          <p className="font-medium text-foreground">{row.guestName}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {format(parseISO(row.checkIn), 'd MMM', { locale: dateLocale })} –{' '}
              {format(parseISO(row.checkOut), 'd MMM yyyy', { locale: dateLocale })} ·{' '}
              {fill(copy.nights, { count: String(row.nights) })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {fill(copy.guests, { count: String(row.guests) })}
            </span>
            {row.pets > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <PawPrint className="h-4 w-4" />
                {fill(copy.pets, { count: String(row.pets) })}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <a
              href={`mailto:${row.guestEmail}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Mail className="h-4 w-4" />
              {row.guestEmail}
            </a>
            {row.guestPhone && (
              <a
                href={`tel:${row.guestPhone}`}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Phone className="h-4 w-4" />
                {row.guestPhone}
              </a>
            )}
          </div>

          {row.extras.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {row.extras.map((extra) => (
                <span
                  key={extra}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {extra}
                </span>
              ))}
            </div>
          )}

          {row.specialRequests && (
            <p className="rounded-[12px] bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{copy.notes}: </span>
              {row.specialRequests}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <p className="text-xl font-semibold text-foreground">${row.total.toLocaleString()}</p>
          {row.refunded > 0 && (
            <p className="text-xs text-muted-foreground">
              {copy.refundAlready}: ${row.refunded.toLocaleString()}
            </p>
          )}
          <div className="flex gap-2">
            {/* Refundable whatever the status: the case that most needs this is
                a stay already cancelled with the money still taken. */}
            {row.paidAt !== null && row.refunded < row.total && (
              <Button variant="outline" size="sm" onClick={() => setRefunding(row)}>
                {copy.refund}
              </Button>
            )}
            {/* A cancelled stay is not editable: its nights are back on sale,
                so "changing" it would quietly re-take them. The API refuses it
                too — this only keeps the host from asking. */}
            {row.status !== 'CANCELLED' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                  {copy.change}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCancelling(row)
                    setReason('')
                  }}
                >
                  {copy.cancel}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{copy.lead}</p>
        </div>
        <Button variant="brand" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {copy.newBooking}
        </Button>
      </div>

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {copy.upcoming} · {upcoming.length}
          </h2>
          {upcoming.map(renderRow)}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {copy.past} · {past.length}
          </h2>
          {pagedPast.visible.map(renderRow)}
          <Pagination
            page={pagedPast.page}
            pages={pagedPast.pages}
            onPage={pagedPast.setPage}
            firstShown={pagedPast.firstShown}
            lastShown={pagedPast.lastShown}
            total={pagedPast.total}
          />
        </section>
      )}

      <EditBookingDialog booking={editing} onClose={() => setEditing(null)} onSaved={load} />

      <Dialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {fill(copy.cancelTitle, { reference: cancelling?.reference ?? '' })}
            </DialogTitle>
            <DialogDescription>{copy.cancelLead}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">{copy.cancelReason}</Label>
            <Input
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)} disabled={busy}>
              {copy.keep}
            </Button>
            <Button variant="destructive" onClick={() => void confirmCancel()} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {copy.cancelConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewBookingDialog open={creating} onOpenChange={setCreating} onCreated={() => void load()} />

      <RefundDialog
        bookingId={refunding?.id ?? null}
        reference={refunding?.reference ?? ''}
        open={refunding !== null}
        onOpenChange={(open) => !open && setRefunding(null)}
        onRefunded={() => void load()}
      />
    </div>
  )
}
