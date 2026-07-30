'use client'

import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import { es as esLocale, ptBR, fr as frLocale, de as deLocale } from 'date-fns/locale'
import { CheckCircle, Calendar, Users, MapPin, Clock, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { currency } from '@/lib/booking'
import { propertyData } from '@/lib/property-data'
import { API_URL } from '@/lib/api-client'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/lib/i18n'

interface ConfirmedBooking {
  reference: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  total: number
  guestName: string
  guestEmail: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT'
  checkInTime: string
  checkOutTime: string
}

const DATE_LOCALES = {
  es: esLocale,
  en: undefined,
  pt: ptBR,
  fr: frLocale,
  de: deLocale,
} as const

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

  const longDate = (value: string) =>
    format(parseISO(value), 'PPP', { locale: DATE_LOCALES[language] })

  if (state === 'loading') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Loader2 className="mb-6 h-10 w-10 animate-spin text-[#174d7a]" />
        <h1 className="mb-2 font-serif text-2xl text-foreground">{copy.checking}</h1>
        <p className="text-muted-foreground">{copy.checkingNote}</p>
      </div>
    )
  }

  if (state === 'missing' || !booking) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <AlertCircle className="h-9 w-9 text-amber-600" />
        </div>
        <h1 className="mb-2 font-serif text-2xl text-foreground">{copy.notFound}</h1>
        <p className="max-w-md text-muted-foreground">{copy.notFoundLead}</p>
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
          <div
            className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${
              settled ? 'bg-success/15' : 'bg-amber-100'
            }`}
          >
            {settled ? (
              <CheckCircle className="h-11 w-11 text-success" />
            ) : (
              <Loader2 className="h-11 w-11 animate-spin text-amber-600" />
            )}
          </div>
          <h1 className="mb-2 font-serif text-3xl text-foreground">
            {settled ? copy.confirmed : copy.pending}
          </h1>
          <p className="mx-auto max-w-lg text-lg text-muted-foreground">
            {settled ? copy.confirmedLead : copy.pendingLead}
          </p>
        </div>

        {/* The reference, given its own weight: it is the one thing worth
            writing down, and the only handle a guest has on their booking. */}
        <div className="mb-8 rounded-[24px] bg-[#f7f2ea] px-6 py-7 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[#174d7a]/70">
            {copy.reference}
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-wider text-[#173a57]">
            {booking.reference}
          </p>
          <p className="mt-2 text-sm text-slate-500">{copy.referenceNote}</p>
        </div>

        <div className="mb-8 rounded-2xl border border-border p-6 md:p-8">
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

              <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
                <Detail icon={Calendar} label={copy.checkIn}>
                  {longDate(booking.checkIn)}
                  <span className="block text-sm text-muted-foreground">{booking.checkInTime}</span>
                </Detail>
                <Detail icon={Calendar} label={copy.checkOut}>
                  {longDate(booking.checkOut)}
                  <span className="block text-sm text-muted-foreground">
                    {booking.checkOutTime}
                  </span>
                </Detail>
                <Detail icon={Users} label={copy.guests}>
                  {booking.guests}
                </Detail>
                <Detail icon={Clock} label={copy.nights}>
                  {booking.nights}
                </Detail>
              </dl>
            </div>
          </div>

          <div className="my-6 h-px bg-border" />

          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-foreground">{copy.total}</span>
            <span className="text-2xl font-semibold text-foreground">
              {currency(booking.total)}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {copy.emailedTo} <span className="font-medium">{booking.guestEmail}</span>
          </p>
        </div>

        <div className="mb-10 rounded-[24px] border border-border bg-secondary p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white">
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

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="outline" size="lg" className="w-full px-6 sm:w-auto">
            <Link href="/#contact">{copy.contactHost}</Link>
          </Button>
          <Button asChild variant="brand" size="lg" className="w-full px-6 font-medium sm:w-auto">
            <Link href="/">{copy.backHome}</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Calendar
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
      <div>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="font-medium text-foreground">{children}</dd>
      </div>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#174d7a]" />
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  )
}
