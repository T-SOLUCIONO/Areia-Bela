'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { enUS, es as esLocale } from 'date-fns/locale'
import { Loader2, Mail, MapPin, Phone, Search, Star, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@areia-bela/ui/card'
import { Input } from '@areia-bela/ui/input'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { apiFetch } from '@/lib/api-client'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'

interface Guest {
  id: string
  name: string
  email: string
  phone: string
  country: string
  stays: number
  nights: number
  totalSpent: number
  firstStay: string | null
  lastStay: string | null
  upcoming: { reference: string; checkIn: string; checkOut: string } | null
  notes: string | null
}

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

  if (!guests) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!guests.length) {
    return (
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>{copy.empty}</EmptyTitle>
          <EmptyDescription>{copy.emptyLead}</EmptyDescription>
        </EmptyHeader>
      </Empty>
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
            className="w-full pl-9 sm:w-64"
          />
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
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-6 sm:justify-end">
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
