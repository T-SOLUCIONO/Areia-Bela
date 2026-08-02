'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Undo2 } from 'lucide-react'
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
import { useAdminLanguage, useAdminCopyRef } from '@/components/admin/admin-language-provider'
import { adminCopy, fill } from '@/lib/admin-i18n'

type RefundReason = 'GRACE' | 'FULL' | 'HALF' | 'NONE' | 'STAY_STARTED'
type RefundStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED'

interface RefundSummary {
  reference: string
  total: number
  paidAt: string | null
  refunded: number
  refundable: number
  policy: string
  proposal: {
    rate: number
    accommodation: number
    serviceFee: number
    cleaningFee: number
    extras: number
    taxes: number
    total: number
    reason: RefundReason
    daysBeforeCheckIn: number
  }
  history: Array<{
    id: string
    amount: number
    proposedAmount: number
    status: RefundStatus
    note: string | null
    failureReason: string | null
    settlesAs: string | null
    cardReference: string | null
    createdAt: string
  }>
  blockedReason: 'NOT_PAID' | 'NOTHING_LEFT' | null
}

const money = (amount: number) =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Sending money back.
 *
 * The policy's figure is shown line by line and then dropped into an editable
 * field. It is a proposal, not a verdict: the host is the one who knows whether
 * the week was resold or whether the guest cancelled for a reason worth being
 * generous about. What the ladder said is stored either way, so the gap between
 * the two stays on the record.
 */
export function RefundDialog({
  bookingId,
  reference,
  open,
  onOpenChange,
  onRefunded,
}: {
  bookingId: string | null
  reference: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefunded: () => void
}) {
  const { language } = useAdminLanguage()
  const copy = adminCopy[language].reservations
  const copyRef = useAdminCopyRef()

  const [summary, setSummary] = useState<RefundSummary | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !bookingId) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setSummary(null)
    setNote('')

    void apiFetch<RefundSummary>(`/bookings/${bookingId}/refund`)
      .then((data) => {
        setSummary(data)
        setAmount(data.proposal.total > 0 ? data.proposal.total.toFixed(2) : '')
      })
      .catch(() => toast.error(copyRef.current.reservations.loadFailed))
      .finally(() => setLoading(false))
    // Not keyed on the message: switching language would refetch and wipe the
    // amount the host had already typed.
  }, [open, bookingId, copyRef])

  const typed = Number(amount)
  const valid =
    summary !== null &&
    summary.blockedReason === null &&
    Number.isFinite(typed) &&
    typed > 0 &&
    typed <= summary.refundable

  const send = async () => {
    if (!bookingId || !valid) return
    setBusy(true)
    try {
      await apiFetch(`/bookings/${bookingId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(typed.toFixed(2)), note: note.trim() || undefined }),
      })
      toast.success(copy.refundOk)
      onOpenChange(false)
      onRefunded()
    } catch (error) {
      // The API's message says which guardrail refused, and it is more useful
      // than a generic failure — it is the difference between "already
      // refunded" and "Stripe is down".
      toast.error(error instanceof Error ? error.message : copy.refundFailed)
    } finally {
      setBusy(false)
    }
  }

  const reasonLabel: Record<RefundReason, string> = {
    FULL: copy.refundReasonFULL,
    HALF: copy.refundReasonHALF,
    NONE: copy.refundReasonNONE,
    GRACE: copy.refundReasonGRACE,
    STAY_STARTED: copy.refundReasonSTAY_STARTED,
  }

  const statusLabel: Record<RefundStatus, string> = {
    SUCCEEDED: copy.refundStatusSUCCEEDED,
    PENDING: copy.refundStatusPENDING,
    FAILED: copy.refundStatusFAILED,
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fill(copy.refundTitle, { reference })}</DialogTitle>
          <DialogDescription>{copy.refundLead}</DialogDescription>
        </DialogHeader>

        {loading || !summary ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : summary.blockedReason ? (
          <p className="rounded-[12px] bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
            {summary.blockedReason === 'NOT_PAID' ? copy.refundNotPaid : copy.refundNothingLeft}
          </p>
        ) : (
          <div className="space-y-5">
            <div className="rounded-[12px] border border-border p-4">
              <p className="text-sm font-medium text-foreground">
                {reasonLabel[summary.proposal.reason]}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {summary.policy} ·{' '}
                {fill(copy.refundDays, { count: String(summary.proposal.daysBeforeCheckIn) })}
              </p>

              <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                <Line label={copy.refundNights} value={summary.proposal.accommodation} />
                <Line label={copy.refundServiceFee} value={summary.proposal.serviceFee} />
                <Line label={copy.refundTaxes} value={summary.proposal.taxes} />
                <Line label={copy.refundCleaning} value={summary.proposal.cleaningFee} />
                {summary.proposal.extras > 0 && (
                  <Line label={copy.refundExtras} value={summary.proposal.extras} />
                )}
                <div className="flex justify-between border-t border-border pt-2 font-medium text-foreground">
                  <dt>{copy.refundProposed}</dt>
                  <dd className="tabular-nums">{money(summary.proposal.total)}</dd>
                </div>
              </dl>
            </div>

            <dl className="grid grid-cols-3 gap-3 text-sm">
              <Stat label={copy.refundPaid} value={money(summary.total)} />
              <Stat label={copy.refundAlready} value={money(summary.refunded)} />
              <Stat label={copy.refundLeft} value={money(summary.refundable)} />
            </dl>

            <div className="space-y-2">
              <Label htmlFor="refund-amount">{copy.refundAmount}</Label>
              <Input
                id="refund-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max={summary.refundable}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              {/* Only when the two actually differ: a warning that is always on
                  is a warning nobody reads. */}
              {valid && Math.abs(typed - summary.proposal.total) >= 0.01 && (
                <p className="flex items-start gap-2 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {fill(copy.refundOverride, {
                    amount: money(typed),
                    proposed: money(summary.proposal.total),
                  })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-note">{copy.refundNote}</Label>
              <Input
                id="refund-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground">{copy.refundTakesDays}</p>

            {summary.history.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {copy.refundHistory}
                </p>
                {summary.history.map((refund) => (
                  <div key={refund.id} className="space-y-1">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {new Date(refund.createdAt).toLocaleDateString()} ·{' '}
                        {statusLabel[refund.status]}
                        {refund.failureReason && ` · ${refund.failureReason}`}
                      </span>
                      <span className="shrink-0 tabular-nums text-foreground">
                        {money(refund.amount)}
                      </span>
                    </div>
                    {/* Which of the two waits applies. Stripe knows; without
                        this the host is guessing when a guest asks. */}
                    {refund.settlesAs && refund.status !== 'FAILED' && (
                      <p className="text-xs text-muted-foreground">
                        {refund.settlesAs === 'reversal'
                          ? copy.refundSettlesReversal
                          : copy.refundSettlesRefund}
                      </p>
                    )}
                    {/* The only thing a guest whose bank says "we see nothing"
                        can actually hand over. */}
                    {refund.cardReference && (
                      <p className="text-xs text-muted-foreground">
                        {copy.refundTrace}:{' '}
                        <span className="font-mono text-foreground">{refund.cardReference}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {copy.keep}
          </Button>
          <Button onClick={() => void send()} disabled={!valid || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            {copy.refundConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{money(value)}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  )
}
