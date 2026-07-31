'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Download, Loader2, LogOut, Mail, PawPrint, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { fill } from '@areia-bela/shared'
import { guest, type MyBooking, type MyDetails } from '@/lib/guest-client'
import { API_URL } from '@/lib/api-client'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/lib/i18n'
import { StayBand } from '@/components/public/stay-band'
import { BookingBillLines } from '@/components/public/booking-bill'
import { BookingTerms } from '@/components/public/booking-terms'
import { cn } from '@/lib/utils'

type Screen = 'loading' | 'signedOut' | 'sent' | 'signedIn'

export default function MyBookingPage() {
  const { language } = useLanguage()
  const copy = translations[language].guestArea

  const [screen, setScreen] = useState<Screen>('loading')
  const [bookings, setBookings] = useState<MyBooking[]>([])
  const [details, setDetails] = useState<MyDetails | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [mine, me] = await Promise.all([guest.bookings(), guest.me()])
      setBookings(mine)
      setDetails(me)
      setScreen('signedIn')
    } catch {
      // 401 is the ordinary case here: nobody is signed in yet.
      setScreen('signedOut')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const requestLink = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await guest.requestLink(email, language)
      // Always the same screen, whether or not that address has a booking.
      // Anything else would answer "has this person stayed here?" to a stranger.
      setScreen('sent')
    } catch {
      toast.error(copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  if (screen === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-9 w-9 animate-spin text-[#174d7a]" />
      </div>
    )
  }

  if (screen === 'sent') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#f7f2ea]">
          <Mail className="h-8 w-8 text-[#174d7a]" />
        </div>
        <h1 className="mb-2 font-serif text-2xl text-foreground">{copy.sentTitle}</h1>
        <p className="text-muted-foreground">{copy.sentLead}</p>
      </div>
    )
  }

  if (screen === 'signedOut') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
        <h1 className="font-serif text-3xl text-foreground">{copy.signInTitle}</h1>
        <p className="mt-2 text-muted-foreground">{copy.signInLead}</p>

        <form onSubmit={(event) => void requestLink(event)} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guest-email">{copy.email}</Label>
            <Input
              id="guest-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 rounded-[12px]"
            />
          </div>
          <Button
            type="submit"
            variant="brand"
            size="lg"
            disabled={busy}
            className="w-full font-semibold"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? copy.sending : copy.sendLink}
          </Button>
        </form>
      </div>
    )
  }

  const upcoming = bookings.filter((booking) => !booking.past)
  const past = bookings.filter((booking) => booking.past)

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-serif text-3xl text-foreground">{copy.title}</h1>
          {details && <p className="mt-1 text-muted-foreground">{details.email}</p>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void guest.signOut().then(() => setScreen('signedOut'))}
        >
          <LogOut className="h-4 w-4" />
          {copy.signOut}
        </Button>
      </header>

      {bookings.length === 0 ? (
        <div className="py-20 text-center">
          <h2 className="font-serif text-xl text-foreground">{copy.noBookings}</h2>
          <p className="mt-2 text-muted-foreground">{copy.noBookingsLead}</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <Section title={copy.upcoming}>
              {upcoming.map((booking) => (
                <BookingCard key={booking.reference} booking={booking} language={language} />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title={copy.past}>
              {past.map((booking) => (
                <BookingCard key={booking.reference} booking={booking} language={language} muted />
              ))}
            </Section>
          )}
        </>
      )}

      {details && <DetailsForm details={details} onSaved={setDetails} language={language} />}
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function BookingCard({
  booking,
  language,
  muted = false,
}: {
  booking: MyBooking
  language: 'es' | 'en' | 'pt' | 'fr' | 'de'
  muted?: boolean
}) {
  const copy = translations[language].guestArea

  const statusLabel = {
    CONFIRMED: copy.statusConfirmed,
    PENDING: copy.statusPending,
    CANCELLED: copy.statusCancelled,
    CHECKED_IN: copy.statusCheckedIn,
    CHECKED_OUT: copy.statusCheckedOut,
  }[booking.status]

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[24px] border border-border bg-card',
        muted && 'opacity-70',
      )}
    >
      <div className="bg-[#f7f2ea] px-6 py-5">
        <StayBand
          checkIn={booking.checkIn}
          checkOut={booking.checkOut}
          nights={booking.nights}
          nightsLabel={fill(copy.nights, { count: String(booking.nights) })}
          arrivalLabel={copy.arrival}
          departureLabel={copy.departure}
          checkInTime={booking.checkInTime}
          checkOutTime={booking.checkOutTime}
          language={language}
        />
      </div>

      <div className="space-y-4 px-6 py-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {fill(copy.guests, { count: String(booking.guests) })}
          </span>
          {booking.pets > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <PawPrint className="h-4 w-4" />
              {fill(copy.pets, { count: String(booking.pets) })}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {statusLabel}
          </span>
        </div>

        {booking.extras.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{copy.extras}: </span>
            {booking.extras.join(', ')}
          </p>
        )}

        {booking.specialRequests && (
          <p className="rounded-[12px] bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{copy.yourNote}: </span>
            {booking.specialRequests}
          </p>
        )}

        {/* An unpaid hold with no way to pay is a dead end. While it lives,
            the same Stripe session is one click away. */}
        {booking.checkoutUrl && (
          <div className="flex flex-col gap-3 rounded-[16px] bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">{copy.finishPayingLead}</p>
            <Button asChild variant="brand" size="sm" className="shrink-0">
              <a href={booking.checkoutUrl}>{copy.finishPaying}</a>
            </Button>
          </div>
        )}

        <div className="grid gap-8 border-t border-border pt-5 sm:grid-cols-2">
          <BookingBillLines bill={booking.bill} nights={booking.nights} language={language} />
          <BookingTerms booking={booking} language={language} />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {copy.reference}
            </p>
            <p className="font-mono text-lg font-semibold tracking-wider text-[#173a57]">
              {booking.reference}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {booking.status !== 'CANCELLED' && (
              <Button asChild variant="outline" size="sm">
                <a href={`${API_URL}/guest/bookings/${booking.reference}/pdf`}>
                  <Download className="h-4 w-4" />
                  {copy.download}
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function DetailsForm({
  details,
  onSaved,
  language,
}: {
  details: MyDetails
  onSaved: (details: MyDetails) => void
  language: 'es' | 'en' | 'pt' | 'fr' | 'de'
}) {
  const copy = translations[language].guestArea
  const [draft, setDraft] = useState(details)
  const [busy, setBusy] = useState(false)

  const changed =
    draft.firstName !== details.firstName ||
    draft.lastName !== details.lastName ||
    draft.phone !== details.phone ||
    draft.country !== details.country

  const save = async () => {
    setBusy(true)
    try {
      onSaved(
        await guest.updateMe({
          firstName: draft.firstName,
          lastName: draft.lastName,
          phone: draft.phone,
          country: draft.country,
        }),
      )
      toast.success(copy.saved)
    } catch {
      toast.error(copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof MyDetails, label: string, type = 'text') => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={draft[key]}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        className="h-11 rounded-[12px]"
      />
    </div>
  )

  return (
    <section className="mt-14 border-t border-border pt-10">
      <h2 className="font-serif text-xl text-foreground">{copy.myDetails}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{copy.detailsLead}</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {field('firstName', copy.firstName)}
        {field('lastName', copy.lastName)}
        {field('phone', copy.phone, 'tel')}
        {field('country', copy.country)}
      </div>

      {/* Editable everywhere except here, and the reason is worth saying out
          loud rather than just greying the field out. */}
      <div className="mt-5 space-y-2">
        <Label htmlFor="locked-email">{copy.email}</Label>
        <Input id="locked-email" value={details.email} disabled className="h-11 rounded-[12px]" />
        <p className="text-xs text-muted-foreground">{copy.emailLocked}</p>
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="brand" onClick={() => void save()} disabled={busy || !changed}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {copy.save}
        </Button>
      </div>
    </section>
  )
}
