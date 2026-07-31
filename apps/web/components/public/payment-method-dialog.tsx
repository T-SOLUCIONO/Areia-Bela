'use client'

import { CreditCard, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@areia-bela/ui/dialog'
import { currency } from '@/lib/booking'
import { translations, type Language } from '@/lib/i18n'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  total: number
  busy: boolean
  language: Language
}

/**
 * The last step before Stripe: what is being charged, and by whom.
 *
 * Deliberately not a list of saved cards. Airbnb can show those because the
 * guest has an account with Airbnb; here the card is entered on Stripe's own
 * page and this site never sees one. A row of card numbers would be a
 * capability we do not have.
 *
 * The wallets are named but qualified. Stripe only offers Apple Pay, Google
 * Pay or Link when the device, browser and country allow it, so promising them
 * outright would be a promise made on someone else's behalf.
 */
export function PaymentMethodDialog({
  open,
  onOpenChange,
  onConfirm,
  total,
  busy,
  language,
}: Props) {
  const copy = translations[language].checkout

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{copy.payTitle}</DialogTitle>
        </DialogHeader>

        <div className="rounded-[16px] border border-[#174d7a] bg-[#174d7a]/5 p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#174d7a]" />
            <div>
              <p className="font-medium text-foreground">{copy.payCard}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{copy.payCardBrands}</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{copy.payWallets}</p>

        <div className="space-y-2 rounded-[16px] bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            {copy.payWhere}
          </p>
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            {copy.payHeld}
          </p>
        </div>

        <div className="flex items-baseline justify-between border-t border-border pt-4">
          <span className="font-medium text-foreground">{translations[language].quote.total}</span>
          <span className="font-serif text-2xl tabular-nums text-foreground">
            {currency(total)}
          </span>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {copy.payCancel}
          </Button>
          <Button variant="brand" size="lg" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {copy.payContinue}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Covers everything while the hold is taken and Stripe is asked for a session.
 *
 * Two network calls happen behind this, and the page underneath is a form the
 * guest could still edit — changing a name after the booking is already held
 * would leave the two out of step. Blocking is the honest state: something is
 * happening and nothing else should.
 */
export function PaymentOverlay({ language }: { language: Language }) {
  const copy = translations[language].checkout

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-white/95 px-6 text-center backdrop-blur-sm"
    >
      <Loader2 className="h-11 w-11 animate-spin text-[#174d7a]" />
      <div>
        <p className="font-serif text-2xl text-[#173a57]">{copy.payOpening}</p>
        <p className="mt-2 max-w-sm text-muted-foreground">{copy.payOpeningLead}</p>
      </div>
    </div>
  )
}
