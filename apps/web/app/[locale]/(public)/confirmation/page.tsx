'use client'

import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle, Users, MapPin, Loader2, AlertCircle, Download } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { propertyData } from '@/lib/property-data'
import { API_URL } from '@/lib/api-client'
import { useLanguage } from '@/components/language-provider'
import { fill } from '@areia-bela/shared'
import { translations } from '@/lib/i18n'
import { StayBand } from '@/components/public/stay-band'
import { BookingBillLines } from '@/components/public/booking-bill'
import { BookingTerms } from '@/components/public/booking-terms'
import type { MyBooking } from '@/lib/guest-client'

/**
 * The same shape the guest area uses, plus who booked it. One description of a
 * booking rather than two that drift: what they see now is what they will see
 * when they sign in next month.
 */
type ConfirmedBooking = MyBooking & { guestName: string; guestEmail: string }

/**
 * Stripe redirects here the moment the card clears, which is usually before
 * its webhook has reached us. Polling covers that gap; without it the page
 * would tell a guest who just paid that their booking does not exist.
 */
const POLL_INTERVAL_MS = 2_000
const POLL_ATTEMPTS = 10

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { language } = useLanguage()
  const copy = translations[language].confirmation

  const [booking, setBooking] = useState<ConfirmedBooking | null>(null)
  const [state, setState] = useState<'loading' | 'found' | 'missing'>('loading')
  const attempts = useRef(0)
  // Stashed on the way out to Stripe. Its presence is proof this browser
  // started a real checkout, which is what separates "the webhook is slow"
  // from "this link goes nowhere".
  //
  // Read once, on the first client render, rather than in an effect: it never
  // changes, and it is only shown in a branch that comes after polling, so the
  // server render never disagrees with it.
  const [stashedReference] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return sessionStorage.getItem('areia-bela:last-reference')
    } catch {
      return null // Private browsing.
    }
  })

  const fetchBooking = useCallback(async () => {
    if (!sessionId) {
      setState('missing')
      return true
    }

    try {
      const response = await fetch(`${API_URL}/bookings/session/${encodeURIComponent(sessionId)}`, {
        cache: 'no-store',
      })
      if (response.ok) {
        setBooking((await response.json()) as ConfirmedBooking)
        setState('found')
        return true
      }
    } catch {
      // Network hiccup. The retry below covers it.
    }

    attempts.current += 1
    if (attempts.current >= POLL_ATTEMPTS) {
      setState('missing')
      return true
    }
    return false
  }, [sessionId])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>

    const tick = async () => {
      const done = await fetchBooking()
      if (!done && !stopped) timer = setTimeout(() => void tick(), POLL_INTERVAL_MS)
    }
    void tick()

    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [fetchBooking])

  // "{count} nights", borrowed from the guest area so the phrase is
  // written once for all five languages.
  const nightsLabel = translations[language].guestArea.nights
  // Reached across from `availability` the same way `nights` is reached across
  // from `guestArea`: the singular and plural already exist there, and a second
  // pair would be a second thing to keep in step.
  const guestWord = translations[language].availability
  const downloadLabel = translations[language].guestArea.download

  if (state === 'loading') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Loader2 className="mb-6 h-10 w-10 animate-spin text-primary" />
        <h1 className="mb-2 font-serif text-2xl text-foreground">{copy.checking}</h1>
        <p className="text-muted-foreground">{copy.checkingNote}</p>
      </div>
    )
  }

  if (state === 'missing' || !booking) {
    // Coming back from Stripe with a session id means the card cleared. Telling
    // that guest we cannot find their booking is both alarming and untrue; the
    // booking exists, the webhook just has not landed.
    const paid = Boolean(sessionId)

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          {paid ? (
            <Loader2 className="h-9 w-9 animate-spin text-amber-600" />
          ) : (
            <AlertCircle className="h-9 w-9 text-amber-600" />
          )}
        </div>
        <h1 className="mb-2 font-serif text-2xl text-foreground">
          {paid ? copy.settling : copy.notFound}
        </h1>
        <p className="max-w-md text-muted-foreground">
          {paid ? copy.settlingLead : copy.notFoundLead}
        </p>

        {paid && stashedReference && (
          <div className="mt-6 rounded-[20px] border border-border bg-secondary px-8 py-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              {copy.reference}
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-foreground">
              {stashedReference}
            </p>
          </div>
        )}

        <Button asChild variant="brand" size="lg" className="mt-8">
          <Link href="/#contact">{copy.contactHost}</Link>
        </Button>
      </div>
    )
  }

  // A booking that exists but is not CONFIRMED yet means the webhook is still
  // in flight. The money is not in doubt — Stripe would not have redirected —
  // so this says so rather than showing a scary error.
  const settled = booking.status !== 'PENDING'

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-12">
        <div className="mb-10 text-center">
          {/* Smaller than it was, and the headline larger. An 80px green disc is
              the stock answer to "confirmation page", and at that size it was
              competing with the sentence that actually says what happened. The
              mark reassures; the words inform. */}
          <div
            className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ${
              settled ? 'bg-success/15' : 'bg-amber-100'
            }`}
          >
            {settled ? (
              <CheckCircle className="h-8 w-8 text-success" />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            )}
          </div>
          <h1 className="mb-2 font-serif text-3xl text-foreground md:text-4xl">
            {settled ? copy.confirmed : copy.pending}
          </h1>
          <p className="mx-auto max-w-lg text-lg text-muted-foreground">
            {settled ? copy.confirmedLead : copy.pendingLead}
          </p>
        </div>

        {/* One object, not three.
        
            The reference used to be its own tinted panel above the booking, which
            put three blocks of near-equal weight on the page in a tan / white /
            tan rhythm and read as three separate things. It is not a sibling of
            the booking — it is the booking's identifier, so it belongs to it, as
            its masthead. That also lets the code sit against a label instead of
            being centred under one, which is the arrangement every document with
            a number uses and the reason it reads as a number worth keeping.
        
            A surface, not just an outline: a border alone cannot separate two
            colours 1.1:1 apart, so the shadow does the lifting. */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border bg-secondary px-6 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                {copy.reference}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{copy.referenceNote}</p>
            </div>
            <p className="font-mono text-2xl font-semibold tracking-wider text-foreground sm:text-3xl">
              {booking.reference}
            </p>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="relative h-40 w-full flex-shrink-0 overflow-hidden rounded-xl md:h-32 md:w-44">
                <Image
                  src={propertyData.photos[0].large}
                  alt={propertyData.name}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="flex-1">
                <h2 className="mb-1 font-serif text-xl text-foreground">{propertyData.name}</h2>
                <div className="mb-5 flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {propertyData.city}, {propertyData.country}
                  </span>
                </div>

                {/* The stay as one thing with two ends — the same shape the
                  calendar used when they picked it — instead of four
                  disconnected facts in a grid. */}
                <StayBand
                  checkIn={booking.checkIn}
                  checkOut={booking.checkOut}
                  nights={booking.nights}
                  nightsLabel={fill(nightsLabel, { count: String(booking.nights) })}
                  arrivalLabel={copy.checkIn}
                  departureLabel={copy.checkOut}
                  checkInTime={booking.checkInTime}
                  checkOutTime={booking.checkOutTime}
                  language={language}
                />

                <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {/* Was `copy.guests.toLowerCase()`, a fixed plural: a booking for
                    one person read "1 huéspedes". */}
                  {booking.guests}{' '}
                  {(booking.guests === 1 ? guestWord.guestOne : guestWord.guestMany).toLowerCase()}
                </p>
              </div>
            </div>

            <div className="my-6 h-px bg-border" />

            {/* Stacked, not two columns.
            
                Side by side they were a summary of four lines beside five hundred
                pixels of prose, so half the card was empty — a hole you read as a
                mistake. They are not siblings of equal weight: one is the money,
                which is a short closed list, and the other is the conditions,
                which are paragraphs. So the money gets a surface of its own,
                tinted to tie it to the reference above it, and the conditions run
                underneath at full width.
            
                This is also what the layout already did on a phone, so the two
                sizes now agree instead of being two different designs. */}
            <div className="rounded-xl border border-border bg-secondary/60 p-5">
              <BookingBillLines bill={booking.bill} nights={booking.nights} language={language} />
            </div>

            <div className="mt-8">
              <BookingTerms booking={booking} language={language} />
            </div>

            <p className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">
              {copy.emailedTo} <span className="font-medium">{booking.guestEmail}</span>
            </p>
          </div>
        </div>

        <div className="mb-10 rounded-[24px] border border-border bg-secondary p-6 shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-card">
              <Image
                src={propertyData.host.pictureUrl}
                alt={propertyData.host.name}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{copy.nextTitle}</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>{copy.nextArrival}</li>
                <li>{copy.nextQuestions}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* The order was upside down: the filled button was "back to home", so
            the loudest thing on a page whose job is handing over a booking sent
            the guest away from it, while the document they would actually want to
            keep sat in a quiet outline.
        
            Now it reads as one next step, one alternative, and a way out — which
            is the real shape of what someone does here. */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {/* Downloadable without signing in: asking someone to request an
              email link before they can keep the receipt for the payment they
              made thirty seconds ago would be absurd. */}
          <Button asChild variant="brand" size="lg" className="w-full px-6 font-medium sm:w-auto">
            <a
              href={`${API_URL}/bookings/session/${encodeURIComponent(sessionId ?? '')}/pdf?locale=${language}`}
            >
              <Download className="h-4 w-4" />
              {downloadLabel}
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full px-6 sm:w-auto">
            <Link href="/#contact">{copy.contactHost}</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="w-full px-6 sm:w-auto">
            <Link href="/">{copy.backHome}</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  )
}
