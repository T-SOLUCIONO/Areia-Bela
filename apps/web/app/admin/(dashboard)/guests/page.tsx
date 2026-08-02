'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { enUS, es as esLocale } from 'date-fns/locale'
import {
  ChevronDown,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
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
import { Textarea } from '@areia-bela/ui/textarea'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { apiFetch, ApiError } from '@/lib/api-client'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'
import { cn } from '@/lib/utils'

interface GuestStay {
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

interface Guest {
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  country: string
  stays: number
  nights: number
  stayHistory: GuestStay[]
  totalSpent: number
  firstStay: string | null
  lastStay: string | null
  upcoming: { reference: string; checkIn: string; checkOut: string } | null
  notes: string | null
}

/** What the dialog edits. `id` empty means a new guest. */
interface GuestForm {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  notes: string
}

const BLANK_FORM: GuestForm = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  country: '',
  notes: '',
}

const formFor = (guest: Guest): GuestForm => ({
  id: guest.id,
  firstName: guest.firstName,
  lastName: guest.lastName,
  email: guest.email,
  phone: guest.phone,
  country: guest.country,
  notes: guest.notes ?? '',
})

/** Initials, not a photo: nobody uploads one and a grey avatar says nothing. */
const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

export default function GuestsPage() {
  const { language, t } = useAdminLanguage()
  const copy = t.guests
  const locale = language === 'en' ? enUS : esLocale

  const [guests, setGuests] = useState<Guest[] | null>(null)
  const [query, setQuery] = useState('')
  // null = closed, a Guest = editing, BLANK_FORM = adding.
  const [editing, setEditing] = useState<GuestForm | null>(null)
  const [removing, setRemoving] = useState<Guest | null>(null)
  const [busy, setBusy] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  // Open one at a time by id rather than a boolean per card: the list is one
  // component and a Set would grow without anyone ever closing them.
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setGuests(await apiFetch<Guest[]>('/customers'))
    } catch {
      toast.error(copy.loadFailed)
      setGuests([])
    }
  }, [copy.loadFailed])

  useEffect(() => {
    // Every setState in `load` happens after an await, so none of them are the
    // synchronous cascade this rule warns about.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const save = async () => {
    if (!editing) return
    const { id, ...body } = editing

    setBusy(true)
    try {
      await apiFetch<Guest>(id ? `/customers/${id}` : '/customers', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      toast.success(copy.saved)
      setEditing(null)
      await load()
    } catch (err) {
      // A duplicate email is the one failure the host can fix; everything else
      // is ours and a specific message would only mislead.
      toast.error(err instanceof ApiError && err.status === 409 ? copy.emailTaken : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Sends the guest their sign-in link again, for the phone call where they
   * say they cannot find it. The host never sees the link — it is made on the
   * server and goes straight to the guest's own address.
   */
  const sendLink = async (target: Guest) => {
    setSendingTo(target.id)
    try {
      await apiFetch<void>(`/customers/${target.id}/send-login-link`, {
        method: 'POST',
        body: JSON.stringify({ locale: language }),
      })
      toast.success(fill(copy.linkSent, { email: target.email }))
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 409 ? copy.linkNoBookings : copy.linkFailed,
      )
    } finally {
      setSendingTo(null)
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await apiFetch<void>(`/customers/${removing.id}`, { method: 'DELETE' })
      toast.success(copy.removed)
      setRemoving(null)
      await load()
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 409 ? copy.removeHasBookings : copy.removeFailed,
      )
    } finally {
      setBusy(false)
    }
  }

  if (!guests) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const dialogs = (
    <>
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id
                ? fill(copy.editTitle, { name: `${editing.firstName} ${editing.lastName}` })
                : copy.newTitle}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="firstName"
                  label={copy.firstName}
                  value={editing.firstName}
                  onChange={(v) => setEditing({ ...editing, firstName: v })}
                />
                <Field
                  id="lastName"
                  label={copy.lastName}
                  value={editing.lastName}
                  onChange={(v) => setEditing({ ...editing, lastName: v })}
                />
              </div>
              <Field
                id="email"
                type="email"
                label={copy.email}
                value={editing.email}
                onChange={(v) => setEditing({ ...editing, email: v })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="phone"
                  type="tel"
                  label={copy.phone}
                  value={editing.phone}
                  onChange={(v) => setEditing({ ...editing, phone: v })}
                />
                <Field
                  id="country"
                  label={copy.country}
                  value={editing.country}
                  onChange={(v) => setEditing({ ...editing, country: v })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{copy.notesLabel}</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={editing.notes}
                  placeholder={copy.notesHint}
                  onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                  className="resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
              {copy.cancel}
            </Button>
            <Button
              variant="brand"
              onClick={() => void save()}
              disabled={
                busy ||
                !editing?.firstName.trim() ||
                !editing?.lastName.trim() ||
                !editing?.email.trim()
              }
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {copy.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{removing && fill(copy.removeTitle, { name: removing.name })}</DialogTitle>
            <DialogDescription>{copy.removeLead}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)} disabled={busy}>
              {copy.cancel}
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {copy.remove}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  if (!guests.length) {
    return (
      <>
        <Empty className="min-h-[60vh]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>{copy.empty}</EmptyTitle>
            <EmptyDescription>{copy.emptyLead}</EmptyDescription>
          </EmptyHeader>
          <Button variant="brand" className="mt-4" onClick={() => setEditing(BLANK_FORM)}>
            <Plus className="h-4 w-4" />
            {copy.add}
          </Button>
        </Empty>
        {dialogs}
      </>
    )
  }

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? guests.filter(
        (guest) =>
          guest.name.toLowerCase().includes(needle) || guest.email.toLowerCase().includes(needle),
      )
    : guests

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl text-foreground">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.lead}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.search}
              aria-label={copy.search}
              className="w-full pl-9 sm:w-64"
            />
          </div>
          <Button variant="brand" onClick={() => setEditing(BLANK_FORM)}>
            <Plus className="h-4 w-4" />
            {copy.add}
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{copy.noMatch}</p>
      ) : (
        <div className="grid gap-3">
          {visible.map((guest) => (
            <Card key={guest.id}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary font-serif text-lg text-primary">
                    {initials(guest.name)}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{guest.name}</p>
                      {/* Worth flagging: a returning guest is the cheapest
                          booking this house will ever get. */}
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

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <a
                        href={`mailto:${guest.email}`}
                        className="inline-flex items-center gap-1.5 hover:text-foreground"
                      >
                        <Mail className="h-4 w-4" />
                        {guest.email}
                      </a>
                      {guest.phone && (
                        <a
                          href={`tel:${guest.phone}`}
                          className="inline-flex items-center gap-1.5 hover:text-foreground"
                        >
                          <Phone className="h-4 w-4" />
                          {guest.phone}
                        </a>
                      )}
                      {guest.country && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          {guest.country}
                        </span>
                      )}
                    </div>

                    {guest.notes && (
                      <p className="truncate text-sm italic text-muted-foreground">{guest.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-5 sm:justify-end">
                  {guest.stays === 0 ? (
                    <p className="text-sm italic text-muted-foreground">{copy.neverStayed}</p>
                  ) : (
                    <>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {guest.stays === 1
                            ? copy.stayOne
                            : fill(copy.stays, { count: String(guest.stays) })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fill(copy.nights, { count: String(guest.nights) })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {copy.spent}
                        </p>
                        <p className="font-serif text-xl tabular-nums text-foreground">
                          ${guest.totalSpent.toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}

                  <div className="flex items-center gap-1">
                    {guest.stays > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={copy.sendLink}
                        title={copy.sendLink}
                        disabled={sendingTo === guest.id}
                        onClick={() => void sendLink(guest)}
                      >
                        {sendingTo === guest.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <KeyRound className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={copy.edit}
                      onClick={() => setEditing(formFor(guest))}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={copy.remove}
                      onClick={() => setRemoving(guest)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* The aggregates said "3 stays, $3,735" and stopped there, so
                    answering "which weeks?" meant leaving for Reservations and
                    searching. The rows were already on the wire. */}
                {guest.stayHistory.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === guest.id ? null : guest.id)}
                      className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          expanded === guest.id && 'rotate-180',
                        )}
                      />
                      {expanded === guest.id ? copy.hideHistory : copy.history}
                    </button>

                    {expanded === guest.id && (
                      <ul className="mt-3 space-y-2">
                        {guest.stayHistory.map((stay) => (
                          <li
                            key={stay.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-[10px] bg-muted/50 px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-foreground">{stay.reference}</span>
                            <span className="text-muted-foreground">
                              {format(parseISO(stay.checkIn), 'd MMM yyyy', { locale: locale })}
                              {' → '}
                              {format(parseISO(stay.checkOut), 'd MMM yyyy', {
                                locale: locale,
                              })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {fill(copy.nights, { count: String(stay.nights) })} · {stay.guests}{' '}
                              <Users className="inline h-3 w-3" />
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {(copy as unknown as Record<string, string>)[
                                `status${stay.status}`
                              ] ?? stay.status}
                              {/* An unpaid hold is not a stay that earned money,
                                  and the total beside it would say otherwise. */}
                              {!stay.paidAt && ` · ${copy.historyUnpaid}`}
                            </span>
                            <span className="ml-auto text-right tabular-nums">
                              <span className="text-foreground">
                                ${stay.total.toLocaleString()}
                              </span>
                              {stay.refunded > 0 && (
                                <span className="block text-xs text-muted-foreground">
                                  − ${stay.refunded.toLocaleString()} {copy.historyRefunded}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialogs}
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
