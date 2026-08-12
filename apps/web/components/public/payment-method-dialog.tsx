'use client'

import { CreditCard, ExternalLink, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@areia-bela/ui/dialog'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { currency } from '@/lib/booking'
import { translations, type Language } from '@/lib/i18n'

/** The countries the form offers, as the checkout page had them. */
const COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'Spain',
  'Brazil',
]

export interface GuestDetails {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  details: GuestDetails
  onDetailsChange: (details: GuestDetails) => void
  total: number
  busy: boolean
  language: Language
}

/**
 * Who the stay is for, and what happens next.
 *
 * The guest's details used to sit halfway down the checkout page, between the
 * extras and the terms, so the pay button was far from the thing it acted on.
 * Gathering them here puts every decision in one place: name, contact, what is
 * being charged, and the one button that leaves for Stripe.
 *
 * The card is not asked for here and never will be. Stripe's own page collects
 * it — this dialog says so rather than implying otherwise with card fields it
 * would have to forward.
 */
export function PaymentMethodDialog({
  open,
  onOpenChange,
  onConfirm,
  details,
  onDetailsChange,
  total,
  busy,
  language,
}: Props) {
  const copy = translations[language].checkout

  const set = (key: keyof GuestDetails) => (value: string) =>
    onDetailsChange({ ...details, [key]: value })

  // The three the API refuses without. Phone and country are asked for but the
  // booking survives without them, so they do not block the button.
  const ready =
    details.firstName.trim() !== '' && details.lastName.trim() !== '' && details.email.trim() !== ''

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{copy.payTitle}</DialogTitle>
        </DialogHeader>

        <div className="rounded-[16px] border border-primary bg-primary/5 p-4 text-primary-foreground">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">{copy.payCard}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{copy.payCardBrands}</p>
              <p className="mt-1 text-sm text-muted-foreground">{copy.payWallets}</p>
            </div>
          </div>
        </div>

        <form
          id="payment-details"
          onSubmit={(event) => {
            event.preventDefault()
            onConfirm()
          }}
          className="space-y-4"
        >
          <p className="text-sm font-medium text-foreground">{copy.guestDetails}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="pay-firstName"
              label={copy.firstName}
              autoComplete="given-name"
              value={details.firstName}
              onChange={set('firstName')}
              required
            />
            <Field
              id="pay-lastName"
              label={copy.lastName}
              autoComplete="family-name"
              value={details.lastName}
              onChange={set('lastName')}
              required
            />
          </div>

          <Field
            id="pay-email"
            label={copy.email}
            type="email"
            autoComplete="email"
            value={details.email}
            onChange={set('email')}
            hint={copy.emailWhy}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="pay-phone"
              label={copy.phone}
              type="tel"
              autoComplete="tel"
              value={details.phone}
              onChange={set('phone')}
              hint={copy.phoneWhy}
            />
            <div className="space-y-2">
              <Label htmlFor="pay-country">{copy.country}</Label>
              <select
                id="pay-country"
                autoComplete="country-name"
                value={details.country}
                onChange={(event) => set('country')(event.target.value)}
                className="h-11 w-full rounded-[12px] border border-border bg-transparent px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>

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
          {/* Submits the form above, so the browser checks the required fields
              and focuses the first empty one before anything is sent. */}
          <Button
            type="submit"
            form="payment-details"
            variant="brand"
            size="lg"
            disabled={busy || !ready}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {copy.payContinue}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  hint,
  required = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  hint?: string
  required?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-[12px] border-border focus-visible:border-primary focus-visible:ring-primary/20"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * Covers everything while the dates are held and Stripe is asked for a page.
 *
 * The dialog underneath is still editable; changing a name after the booking
 * is already held would leave the two out of step.
 */
export function PaymentOverlay({ language }: { language: Language }) {
  const copy = translations[language].checkout

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-card/95 px-6 text-center backdrop-blur-sm"
    >
      <Loader2 className="h-11 w-11 animate-spin text-primary" />
      <div>
        <p className="font-serif text-2xl text-foreground">{copy.payOpening}</p>
        <p className="mt-2 max-w-sm text-muted-foreground">{copy.payOpeningLead}</p>
      </div>
    </div>
  )
}
