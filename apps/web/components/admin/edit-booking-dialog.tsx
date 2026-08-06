'use client'

import { useState } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
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
import { apiFetch } from '@/lib/api-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/** Only what this dialog needs, so it does not care about the rest of the row. */
export interface EditableBooking {
  id: string
  reference: string
  checkIn: string
  checkOut: string
  guests: number
  total: number
  paidAt: string | null
}

interface Props {
  booking: EditableBooking | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}

/**
 * Moves a stay that already exists.
 *
 * Until this existed, a guest phoning to shift a weekend meant cancelling and
 * rebooking — which loses the reference, the history and any refund arithmetic
 * already done.
 *
 * It shows the difference against the old total and **says who settles it**,
 * because the API deliberately does not: charging a saved card needs the guest
 * to authorise it, and refunding automatically would bypass the policy ladder.
 * A dialog that moved money quietly would be the worst of both.
 */
export function EditBookingDialog({ booking, onClose, onSaved }: Props) {
  const t = useAdminCopy()
  const copy = t.reservations
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [adults, setAdults] = useState(1)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // Seeded from the booking each time the dialog opens, keyed on its id so a
  // second booking does not inherit the first one's edits.
  const [seeded, setSeeded] = useState<string | null>(null)
  if (booking && seeded !== booking.id) {
    setSeeded(booking.id)
    setCheckIn(booking.checkIn.slice(0, 10))
    setCheckOut(booking.checkOut.slice(0, 10))
    setAdults(booking.guests)
    setReason('')
  }

  const nights =
    checkIn && checkOut ? differenceInCalendarDays(new Date(checkOut), new Date(checkIn)) : 0
  const unchanged =
    booking !== null &&
    checkIn === booking.checkIn.slice(0, 10) &&
    checkOut === booking.checkOut.slice(0, 10) &&
    adults === booking.guests

  const save = async () => {
    if (!booking) return
    setBusy(true)
    try {
      const result = await apiFetch<{ difference: number; quote: { total: number } }>(
        `/bookings/${booking.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            checkIn,
            checkOut,
            guests: { adults, children: 0, infants: 0 },
            reason: reason.trim() || undefined,
          }),
        },
      )

      // The figure is the point of the message: a host who moves a paid stay
      // needs to know there is money outstanding before they hang up.
      if (result.difference === 0) toast.success(copy.changed_ok)
      else if (result.difference > 0)
        toast.success(`${copy.changed_ok} ${copy.changedOwes} $${result.difference}`)
      else toast.success(`${copy.changed_ok} ${copy.changedRefund} $${Math.abs(result.difference)}`)

      onClose()
      await onSaved()
    } catch (error) {
      // The API's own words: "those dates are already taken" is something the
      // host can act on, and a generic failure is not.
      toast.error(error instanceof Error ? error.message : copy.changeFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={booking !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.change}</DialogTitle>
          <DialogDescription>
            {booking ? `${booking.reference} · ${copy.changeHint}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="editCheckIn">{copy.changeCheckIn}</Label>
              <Input
                id="editCheckIn"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editCheckOut">{copy.changeCheckOut}</Label>
              <Input
                id="editCheckOut"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="editAdults">{copy.guests}</Label>
            <Input
              id="editAdults"
              type="number"
              min={1}
              max={8}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="editReason">{copy.changeReason}</Label>
            <Input
              id="editReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={copy.changeReasonHint}
            />
          </div>

          {/* No price preview on purpose. The server is the only thing that
              decides what a stay costs, and a figure computed here to be
              replaced a second later is a figure that can disagree with the
              one the guest is told. The difference arrives with the answer. */}
          <p className="text-xs text-muted-foreground">
            {nights > 0
              ? `${nights} ${nights === 1 ? copy.nightOne : copy.nightMany}`
              : copy.changeDatesInvalid}
            {booking?.paidAt ? ` · ${copy.changePaidWarning}` : ''}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            variant="brand"
            onClick={() => void save()}
            disabled={busy || unchanged || nights <= 0}
          >
            {copy.saveChange}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
