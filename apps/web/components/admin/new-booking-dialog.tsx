'use client'

import { useEffect, useState } from 'react'
import { Loader2, Phone } from 'lucide-react'
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
import { PROPERTY_SLUG } from '@/lib/property-data'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'
import { cn } from '@/lib/utils'

type Method = 'CASH' | 'TRANSFER' | 'CARD' | 'OTHER'

interface Quote {
  nights: number
  minNights: number
  subtotal: number
  weeklyDiscount: number
  extrasTotal: number
  additionalGuestFee: number
  cleaningFee: number
  serviceFee: number
  taxes: number
  total: number
}

interface Created {
  reference: string
  checkoutUrl: string | null
}

const BLANK = {
  checkIn: '',
  checkOut: '',
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  country: '',
  specialRequests: '',
}

/**
 * A stay taken over the phone.
 *
 * The price is quoted live from the server as the dates change, because the
 * host is on a call and has to say a number out loud. Nothing here computes it:
 * the same endpoint the public quoter uses answers, so the figure said on the
 * phone is the figure that gets charged.
 *
 * The length limits are shown, not enforced. They exist to stop a stranger
 * taking a single night over Christmas; the person on the call is the one who
 * set them, and refusing her own exception would be the software arguing with
 * its owner.
 */
export function NewBookingDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { language, t } = useAdminLanguage()
  const copy = t.reservations

  const [form, setForm] = useState(BLANK)
  const [collected, setCollected] = useState(true)
  const [method, setMethod] = useState<Method>('CASH')
  const [quote, setQuote] = useState<Quote | null>(null)
  // Which inputs the quote on hand belongs to. "Still working it out" is then
  // a comparison rather than a third flag set inside the effect — the same
  // shape as the payments screen's period.
  const [quotedFor, setQuotedFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(BLANK)
    setQuote(null)
    setQuotedFor(null)
    setCollected(true)
  }, [open])

  const { checkIn, checkOut, adults, children, infants } = form

  // Derived, not stored: "these dates cannot be priced" is a fact about the
  // form, and setting state for it inside the effect makes React re-render to
  // learn something it already knew.
  const datesUsable = Boolean(checkIn && checkOut && checkOut > checkIn)

  const key = `${checkIn}|${checkOut}|${adults}|${children}|${infants}`

  useEffect(() => {
    if (!datesUsable) return

    let cancelled = false
    // A small debounce: typing a date fires on every keystroke in some
    // browsers, and each one is a round trip.
    const timer = setTimeout(() => {
      void apiFetch<Quote>(`/properties/${PROPERTY_SLUG}/quote`, {
        method: 'POST',
        body: JSON.stringify({
          checkIn,
          checkOut,
          guests: { adults, children, infants },
          extraIds: [],
        }),
      })
        .then((next) => !cancelled && setQuote(next))
        .catch(() => !cancelled && setQuote(null))
        .finally(() => !cancelled && setQuotedFor(key))
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [datesUsable, key, checkIn, checkOut, adults, children, infants])

  const quoting = datesUsable && quotedFor !== key
  // A quote left over from inputs that have since changed is not a quote.
  const shown = datesUsable && quotedFor === key ? quote : null

  const ready =
    shown !== null &&
    form.firstName.trim() !== '' &&
    form.lastName.trim() !== '' &&
    form.email.trim() !== '' &&
    form.phone.trim() !== '' &&
    form.country.trim() !== ''

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    try {
      const created = await apiFetch<Created>(`/bookings/${PROPERTY_SLUG}/manual`, {
        method: 'POST',
        body: JSON.stringify({
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          guests: {
            adults: form.adults,
            children: form.children,
            infants: form.infants,
            pets: form.pets,
          },
          guest: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            country: form.country.trim(),
          },
          extraIds: [],
          specialRequests: form.specialRequests.trim() || undefined,
          ...(collected ? { paymentMethod: method } : {}),
          locale: language,
        }),
      })

      if (created.checkoutUrl) {
        // Straight to the clipboard: the host is on the phone and about to
        // paste it into a message, not read a URL out loud.
        await navigator.clipboard.writeText(created.checkoutUrl).catch(() => undefined)
        toast.success(fill(copy.bkCreatedLink, { reference: created.reference }))
      } else {
        toast.success(fill(copy.bkCreated, { reference: created.reference }))
      }

      onOpenChange(false)
      onCreated()
    } catch (error) {
      // The API's message names the reason — the dates are taken, they are
      // blocked — and that beats a generic failure.
      toast.error(error instanceof Error ? error.message : copy.bkFailed)
    } finally {
      setBusy(false)
    }
  }

  const money = (amount: number) => `$${amount.toLocaleString()}`

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
            <Phone className="h-5 w-5 text-primary" />
            {copy.newBookingTitle}
          </DialogTitle>
          <DialogDescription>{copy.newBookingLead}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Section title={copy.bkDates}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="bk-in"
                label={copy.bkArrival}
                type="date"
                value={form.checkIn}
                onChange={(value) => set('checkIn', value)}
              />
              <Field
                id="bk-out"
                label={copy.bkDeparture}
                type="date"
                min={form.checkIn || undefined}
                value={form.checkOut}
                onChange={(value) => set('checkOut', value)}
              />
            </div>
          </Section>

          <Section title={copy.bkParty}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(
                [
                  ['adults', copy.bkAdults, 1],
                  ['children', copy.bkChildren, 0],
                  ['infants', copy.bkInfants, 0],
                  ['pets', copy.bkPets, 0],
                ] as const
              ).map(([key, label, floor]) => (
                <Field
                  key={key}
                  id={`bk-${key}`}
                  label={label}
                  type="number"
                  min={String(floor)}
                  value={String(form[key])}
                  onChange={(value) => set(key, Math.max(floor, Number(value) || 0))}
                />
              ))}
            </div>
          </Section>

          <Section title={copy.bkGuest}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="bk-first"
                label={copy.bkFirstName}
                value={form.firstName}
                onChange={(value) => set('firstName', value)}
              />
              <Field
                id="bk-last"
                label={copy.bkLastName}
                value={form.lastName}
                onChange={(value) => set('lastName', value)}
              />
              <Field
                id="bk-email"
                label={copy.bkEmail}
                type="email"
                value={form.email}
                onChange={(value) => set('email', value)}
              />
              <Field
                id="bk-phone"
                label={copy.bkPhone}
                type="tel"
                value={form.phone}
                onChange={(value) => set('phone', value)}
              />
              <Field
                id="bk-country"
                label={copy.bkCountry}
                value={form.country}
                onChange={(value) => set('country', value)}
              />
              <Field
                id="bk-notes"
                label={copy.bkNotes}
                value={form.specialRequests}
                onChange={(value) => set('specialRequests', value)}
              />
            </div>
          </Section>

          <Section title={copy.bkPayment}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice
                selected={collected}
                onSelect={() => setCollected(true)}
                title={copy.bkCollected}
                hint={copy.bkCollectedHint}
              />
              <Choice
                selected={!collected}
                onSelect={() => setCollected(false)}
                title={copy.bkLink}
                hint={copy.bkLinkHint}
              />
            </div>

            {collected && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(['CASH', 'TRANSFER', 'CARD', 'OTHER'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMethod(option)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm ring-1 ring-inset transition-colors',
                      method === option
                        ? 'bg-primary text-primary-foreground ring-primary'
                        : 'bg-transparent text-muted-foreground ring-border hover:text-foreground',
                    )}
                  >
                    {(copy as unknown as Record<string, string>)[`bkMethod${option}`]}
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* The number the host says out loud. Server-computed, never here. */}
          <div className="rounded-[12px] bg-muted/60 p-4">
            {quoting ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.bkQuoting}
              </p>
            ) : !shown ? (
              <p className="text-sm text-muted-foreground">{copy.bkNoQuote}</p>
            ) : (
              <div className="space-y-2">
                <Row
                  label={fill(copy.bkNights, { count: String(shown.nights) })}
                  value={money(shown.subtotal)}
                />
                {shown.weeklyDiscount > 0 && (
                  <Row label={copy.refundNights} value={`− ${money(shown.weeklyDiscount)}`} />
                )}
                {shown.additionalGuestFee > 0 && (
                  <Row label={copy.bkParty} value={money(shown.additionalGuestFee)} />
                )}
                {shown.cleaningFee > 0 && (
                  <Row label={copy.refundCleaning} value={money(shown.cleaningFee)} />
                )}
                {shown.serviceFee > 0 && (
                  <Row label={copy.refundServiceFee} value={money(shown.serviceFee)} />
                )}
                <Row label={copy.refundTaxes} value={money(shown.taxes)} />
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
                  <span>{copy.bkTotal}</span>
                  <span className="tabular-nums">{money(shown.total)}</span>
                </div>

                {/* Shown, not enforced: the host set the minimum and may take
                    an exception to it. */}
                {shown.nights < shown.minNights && (
                  <p className="pt-1 text-xs text-amber-800">
                    {fill(copy.bkTooShort, { count: String(shown.minNights) })}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button variant="brand" onClick={() => void submit()} disabled={!ready || busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {copy.bkCreate}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  min,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  min?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function Choice({
  selected,
  onSelect,
  title,
  hint,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-[12px] border p-3 text-left transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground',
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
