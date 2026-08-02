'use client'

import { format, parseISO } from 'date-fns'
import { enUS, es as esLocale } from 'date-fns/locale'
import { KeyRound, Loader2, Mail, MapPin, Pencil, Phone, Star, Users } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@areia-bela/ui/dialog'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'
import { cn } from '@/lib/utils'

export interface GuestStay {
  id: string
  reference: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  total: number
  status: string
  paidAt: string | null
  refunded: number
}

export interface GuestDetail {
  id: string
  name: string
  email: string
  phone: string
  country: string
  stays: number
  nights: number
  totalSpent: number
  upcoming: { reference: string; checkIn: string; checkOut: string } | null
  stayHistory: GuestStay[]
  notes: string | null
}

/** Same palette as the Reservations screen: one status, one look. */
const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  CHECKED_IN: 'bg-sky-50 text-sky-700 ring-sky-200',
  CHECKED_OUT: 'bg-slate-50 text-slate-600 ring-slate-200',
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

/**
 * Everything about one guest, in one place.
 *
 * The history first lived inside the list, expanding a card downwards. It made
 * the row taller than the screen, pushed every other guest out of view, and
 * left the reader without the thing they had been looking at. A person is a
 * subject you open, not a row you unfold — and opening one gives room for the
 * contact details, the money and the stays to sit together instead of
 * competing for a single line.
 */
export function GuestDetailDialog({
  guest,
  open,
  onOpenChange,
  onEdit,
  onSendLink,
  sendingLink,
}: {
  guest: GuestDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onSendLink: () => void
  sendingLink: boolean
}) {
  const { language, t } = useAdminLanguage()
  const copy = t.guests
  const locale = language === 'en' ? enUS : esLocale

  if (!guest) return null

  const money = (amount: number) => `$${amount.toLocaleString()}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        {/* Sticky so the name stays put while a long history scrolls under it. */}
        <DialogHeader className="sticky top-0 z-10 space-y-0 border-b border-border bg-background px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary font-serif text-xl text-primary">
              {initials(guest.name)}
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-left font-serif text-2xl">
                {guest.name}
              </DialogTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {guest.stays > 1 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                    <Star className="h-3 w-3" />
                    {copy.returning}
                  </span>
                )}
                {guest.upcoming && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    {fill(copy.arriving, {
                      date: format(parseISO(guest.upcoming.checkIn), 'd MMM', { locale }),
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a
              href={`mailto:${guest.email}`}
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-4 w-4 shrink-0" />
              {guest.email}
            </a>
            {guest.phone && (
              <a
                href={`tel:${guest.phone}`}
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-4 w-4 shrink-0" />
                {guest.phone}
              </a>
            )}
            {guest.country && (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                {guest.country}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-3 gap-3">
            <Stat
              label={guest.stays === 1 ? copy.stayOne : fill(copy.stays, { count: '' }).trim()}
              value={String(guest.stays)}
            />
            <Stat label={fill(copy.nights, { count: '' }).trim()} value={String(guest.nights)} />
            <Stat label={copy.spent} value={money(guest.totalSpent)} strong />
          </dl>

          {guest.notes && (
            <div className="rounded-[12px] bg-amber-50/60 p-4 ring-1 ring-inset ring-amber-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                {copy.notesLabel}
              </p>
              <p className="mt-1 text-sm text-amber-900">{guest.notes}</p>
            </div>
          )}

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.history} · {guest.stayHistory.length}
            </h3>

            {guest.stayHistory.length === 0 ? (
              <p className="rounded-[12px] bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
                {copy.neverStayed}
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-[12px] border border-border">
                {guest.stayHistory.map((stay) => (
                  <li
                    key={stay.id}
                    className="flex items-start justify-between gap-4 bg-muted/30 px-4 py-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium tabular-nums text-foreground">
                          {stay.reference}
                        </span>
                        {/* Colour repeats the word, never replaces it. */}
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs ring-1 ring-inset',
                            STATUS_STYLE[stay.status] ??
                              'bg-slate-100 text-slate-600 ring-slate-200',
                          )}
                        >
                          {(copy as unknown as Record<string, string>)[`status${stay.status}`] ??
                            stay.status}
                        </span>
                      </div>

                      <p className="text-sm text-foreground">
                        {format(parseISO(stay.checkIn), 'd MMM', { locale })}
                        <span className="text-muted-foreground"> → </span>
                        {format(parseISO(stay.checkOut), 'd MMM yyyy', { locale })}
                      </p>

                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{fill(copy.nights, { count: String(stay.nights) })}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {stay.guests}
                        </span>
                        {/* An unpaid hold is not a stay that earned money, and
                            the total beside it says otherwise unless this is
                            spelled out. */}
                        {!stay.paidAt && (
                          <span className="font-medium text-amber-700">{copy.historyUnpaid}</span>
                        )}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          'tabular-nums',
                          stay.paidAt ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {money(stay.total)}
                      </p>
                      {stay.refunded > 0 && (
                        <p className="text-xs tabular-nums text-muted-foreground">
                          − {money(stay.refunded)}
                          <span className="block">{copy.historyRefunded}</span>
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-background px-6 py-4">
          {guest.stays > 0 && (
            <Button variant="outline" onClick={onSendLink} disabled={sendingLink}>
              {sendingLink ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {copy.sendLink}
            </Button>
          )}
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            {copy.edit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Stat({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="rounded-[12px] bg-muted/60 px-3 py-3 text-center">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mt-1 tabular-nums text-foreground',
          strong ? 'font-serif text-xl' : 'text-lg',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
