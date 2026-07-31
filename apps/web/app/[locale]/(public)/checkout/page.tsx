'use client'

import { Suspense, useRef, useState } from 'react'
import { useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { format, parseISO, subDays } from 'date-fns'
import { Star, ShieldCheck, Clock, CalendarX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Textarea } from '@areia-bela/ui/textarea'
import {
  currency,
  fetchNightRates,
  getQuoteFromStorage,
  fetchQuote,
  parseQuoteRequestFromSearchParams,
  saveQuoteToStorage,
  type BookingQuote,
} from '@/lib/booking'
import { propertyData } from '@/lib/property-data'
import { createCheckoutSession, DatesUnavailableError, StayLengthError } from '@/services/payment'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/lib/i18n'
import { PriceBreakdownCard } from '@/components/public/price-breakdown-card'
import { StayExtras } from '@/components/public/stay-extras'
import { HostResponseBadges } from '@/components/public/host-response-badges'

const guestLabel = (
  adults: number,
  children: number,
  infants: number,
  pets: number,
  isEnglish: boolean,
) => {
  const parts: string[] = []
  const totalGuests = adults + children
  parts.push(
    `${totalGuests} ${totalGuests !== 1 ? (isEnglish ? 'guests' : 'huéspedes') : isEnglish ? 'guest' : 'huésped'}`,
  )
  if (infants > 0)
    parts.push(
      `${infants} ${infants !== 1 ? (isEnglish ? 'infants' : 'bebés') : isEnglish ? 'infant' : 'bebé'}`,
    )
  if (pets > 0)
    parts.push(
      `${pets} ${pets !== 1 ? (isEnglish ? 'pets' : 'mascotas') : isEnglish ? 'pet' : 'mascota'}`,
    )
  return parts.join(', ')
}

function CheckoutForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const isEnglish = language === 'en'
  // Only the stay's inputs come from the URL; the price is asked for again.
  const request = useMemo(
    () => parseQuoteRequestFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )
  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState<'taken' | 'failed' | 'missingDetails' | null>(null)
  // Checked on arrival, not at payment. Someone can sit on this page for an
  // hour, or land here from a stale link — finding out the week is gone after
  // typing a name, an email and a phone number is the worst possible moment.
  const [datesGone, setDatesGone] = useState(false)
  const warned = useRef(false)
  const copy = translations[language].checkout
  // Extras the guest adds here, keyed by extra id. Seeded from the URL so the
  // pet fee picked in the quoter survives, and so does a page refresh.
  const [chosenExtras, setChosenExtras] = useState<Record<string, number>>(
    () => request?.extraUnits ?? {},
  )
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: 'United States',
    specialRequests: '',
  })

  useEffect(() => {
    if (!request) {
      // Nothing to price. The stored quote is only a convenience for a
      // refresh; it is still re-priced below on the way to payment.
      const persisted = getQuoteFromStorage()
      if (persisted) setQuote(persisted)
      else router.replace('/')
      return
    }

    let cancelled = false
    // Re-priced whenever the extras change. The browser never adds the new
    // line itself: the server owns the arithmetic, so the figure on screen is
    // the figure Stripe will charge.
    void fetchQuote({
      ...request,
      selectedExtraIds: Object.keys(chosenExtras),
      extraUnits: chosenExtras,
    }).then((priced) => {
      if (cancelled) return
      if (priced) {
        setQuote(priced)
        saveQuoteToStorage(priced)
      } else {
        router.replace('/')
      }
    })

    return () => {
      cancelled = true
    }
  }, [request, router, chosenExtras])

  useEffect(() => {
    if (!request) return

    let cancelled = false
    void fetchNightRates(request.checkIn, request.checkOut).then((nights) => {
      // The API returns one night per date in the range; check-out is not one
      // of them, so every night it does return has to be free.
      if (!cancelled && nights.some((night) => !night.available)) setDatesGone(true)
    })

    return () => {
      cancelled = true
    }
  }, [request])

  useEffect(() => {
    // Once, and in whatever language is on screen when it happens. Switching
    // language afterwards should not shout at the guest a second time.
    if (!datesGone || warned.current) return
    warned.current = true
    toast.error(copy.datesTakenToast, { description: copy.datesTaken, duration: 10_000 })
  }, [datesGone, copy])

  if (!quote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="mt-4 text-muted-foreground">
            {isEnglish ? 'Loading your reservation...' : 'Cargando tu reserva...'}
          </p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreedToTerms || datesGone) return

    // Belt and braces: native validation covers this, but a missing field must
    // never reach the API as an opaque 400 the guest cannot act on.
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      setError('missingDetails')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Dates, guests and extras. No total: the API prices this stay and holds
      // the dates. A total sent from a browser is a total a browser can
      // change, and dates merely checked are dates two people can buy at once.
      const session = await createCheckoutSession({
        checkIn: quote.checkIn,
        checkOut: quote.checkOut,
        guests: quote.guests,
        guest: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          country: formData.country,
        },
        specialRequests: formData.specialRequests || undefined,
        locale: language,
        // What was chosen, not what the quote came back with: an extra whose
        // season covers none of these nights is priced at zero and must not be
        // re-sent as if it had been bought.
        extraIds: Object.keys(chosenExtras),
        extraUnits: chosenExtras,
      })

      // Kept for the confirmation page: if the webhook is slow, that page can
      // still show the guest their reference instead of telling someone who
      // just paid that their booking does not exist.
      try {
        sessionStorage.setItem('areia-bela:last-reference', session.reference)
      } catch {
        // Private browsing. Not worth failing a payment over.
      }

      window.location.href = session.url
    } catch (err) {
      console.error('Checkout error:', err)
      if (err instanceof DatesUnavailableError) {
        setError('taken')
        setDatesGone(true)
        toast.error(copy.datesTakenToast, { description: copy.datesTaken, duration: 10_000 })
      } else if (err instanceof StayLengthError) {
        // The server's message names the actual limit, which no fixed string
        // here could — the host changes it from the panel.
        setError('failed')
        toast.error(err.message)
      } else {
        setError('failed')
        toast.error(copy.checkoutFailed)
      }
      setIsLoading(false)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const cancellationDate = format(subDays(parseISO(quote.checkIn), 5), 'MMM d')

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-12">
        <Button
          asChild
          variant="ghost"
          className="mb-6 h-10 rounded-full px-3 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <Link href="/">← {isEnglish ? 'Back to home' : 'Volver al inicio'}</Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left Column - Form */}
          <div className="lg:col-span-3 space-y-8">
            {/* Header Section */}
            <div className="border-b border-border pb-6">
              <h1 className="font-serif text-3xl text-foreground">
                {isEnglish ? 'Confirm and pay' : 'Confirmar y pagar'}
              </h1>
            </div>

            {/* A toast is dismissible and this is not a detail: the whole page
                below is now pointless. It stays until they pick other dates. */}
            {datesGone && (
              <div
                role="alert"
                className="flex flex-col gap-4 rounded-[20px] border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <CalendarX className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <p className="font-semibold text-red-900">{copy.datesTakenToast}</p>
                    <p className="mt-1 text-sm text-red-700">{copy.datesTaken}</p>
                  </div>
                </div>
                <Button asChild variant="brand" size="sm" className="shrink-0">
                  <Link href="/#reservar">{copy.pickOthers}</Link>
                </Button>
              </div>
            )}

            {/* Property Card */}
            <div className="rounded-xl border border-border p-5">
              <div className="flex gap-4">
                <div className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={propertyData.photos[0].large}
                    alt={propertyData.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{propertyData.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {propertyData.city}, {propertyData.country}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <Star className="h-4 w-4 fill-foreground text-foreground" />
                    <span className="font-medium text-foreground">
                      {propertyData.rating.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">
                      ({propertyData.reviewsCount} {isEnglish ? 'reviews' : 'reseñas'})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trip Details */}
            <section className="space-y-4">
              <h2 className="font-serif text-xl text-foreground">
                {isEnglish ? 'Your trip' : 'Tu viaje'}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {isEnglish ? 'Dates' : 'Fechas'}
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {format(parseISO(quote.checkIn), 'MMM d')} -{' '}
                    {format(parseISO(quote.checkOut), 'MMM d, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {quote.nights} {isEnglish ? 'nights' : 'noches'}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {isEnglish ? 'Guests' : 'Huéspedes'}
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {guestLabel(
                      quote.guests.adults,
                      quote.guests.children,
                      quote.guests.infants,
                      quote.guests.pets,
                      isEnglish,
                    )}
                  </p>
                </div>
              </div>
            </section>

            {/* Cancellation Policy */}
            <section className="rounded-xl border border-border p-5 bg-muted/40">
              <div className="flex items-start gap-4">
                <Clock className="h-6 w-6 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">
                    {isEnglish ? 'Free cancellation' : 'Cancelación gratuita'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isEnglish
                      ? `Cancel before ${cancellationDate} for a partial refund. After that, cancel before check-in to get a 50% refund, minus the service fee.`
                      : `Cancela antes del ${cancellationDate} para un reembolso parcial. Después de eso, cancela antes del check-in para obtener un reembolso del 50%, menos la tarifa de servicio.`}
                  </p>
                </div>
              </div>
            </section>

            {/* Message to Host */}
            <section className="space-y-4 rounded-[24px] border border-border bg-card p-5">
              <h2 className="font-serif text-xl text-foreground">
                {isEnglish ? 'Message the host' : 'Mensaje a la anfitriona'}
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-full">
                  <Image
                    src={propertyData.host.pictureUrl}
                    alt={propertyData.host.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {isEnglish ? 'Hosted by' : 'Anfitriona'} {propertyData.host.firstName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isEnglish ? 'Host since' : 'Anfitriona desde'} {propertyData.hostSinceYear}
                  </p>
                </div>
              </div>
              <HostResponseBadges
                isSuperhost={propertyData.host.isSuperhost}
                responseTime={propertyData.hostResponseTime}
                responseRate={propertyData.host.responseRateWithoutNa}
                language={language}
              />
              <Textarea
                id="specialRequests"
                name="specialRequests"
                value={formData.specialRequests}
                onChange={handleInputChange}
                placeholder={
                  isEnglish
                    ? "Let the host know a little about yourself and why you're traveling..."
                    : 'Cuéntale a la anfitriona un poco sobre ti y por qué viajas...'
                }
                rows={4}
                className="resize-none rounded-[16px] border-border bg-background/60"
              />
              <p className="text-sm text-muted-foreground">
                {isEnglish
                  ? "By messaging the host, you agree to the host's house rules and the "
                  : 'Al enviar un mensaje a la anfitriona, aceptas las reglas de la casa y la '}
                <Link href="#" className="underline">
                  {isEnglish ? 'guest refund policy' : 'política de reembolso para huéspedes'}
                </Link>
                .
              </p>
            </section>

            {/* Before the form: the guest decides what they are buying, then
                gives their details. Reversing that means typing a phone number
                and then being surprised by a new line on the total. */}
            <StayExtras
              checkIn={quote.checkIn}
              checkOut={quote.checkOut}
              selected={chosenExtras}
              onChange={setChosenExtras}
              language={language}
              className="border-t border-border pt-6"
            />

            {/* Guest Information */}
            <section className="space-y-4">
              <h2 className="font-serif text-xl text-foreground">
                {isEnglish ? 'Guest information' : 'Información del huésped'}
              </h2>
              <form id="checkout-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="firstName" className="text-sm font-medium text-foreground">
                      {isEnglish ? 'First name' : 'Nombre'}
                    </Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="rounded-lg border-input"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName" className="text-sm font-medium text-foreground">
                      {isEnglish ? 'Last name' : 'Apellido'}
                    </Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="rounded-lg border-input"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    {isEnglish ? 'Email address' : 'Correo electrónico'}
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="rounded-lg border-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    {isEnglish
                      ? 'Confirmation will be sent to this email'
                      : 'La confirmación se enviará a este correo'}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-sm font-medium text-foreground">
                    {isEnglish ? 'Phone number' : 'Número de teléfono'}
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="rounded-lg border-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="country" className="text-sm font-medium text-foreground">
                    {isEnglish ? 'Country/Region' : 'País/Región'}
                  </Label>
                  <select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-input px-3 py-2 text-sm"
                  >
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Australia">Australia</option>
                    <option value="Germany">Germany</option>
                    <option value="France">France</option>
                    <option value="Spain">Spain</option>
                    <option value="Brazil">Brazil</option>
                  </select>
                </div>
              </form>
            </section>

            {/* The card-brand chips that used to head this section are gone.
                This page never sees a card — Stripe's own page does — so a row
                of accepted-card logos was claiming a capability it does not
                have, and putting it above the total implied the card was
                entered here. */}
            <section className="space-y-4">
              <div className="rounded-[20px] bg-[#f7f2ea] p-6">
                <div className="mb-5 flex items-baseline justify-between border-b border-[#174d7a]/15 pb-4">
                  <span className="font-medium text-[#173a57]">Total (USD)</span>
                  <span className="font-serif text-3xl tabular-nums text-[#173a57]">
                    {currency(quote.total)}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="agreeTerms"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#174d7a]"
                    />
                    <label htmlFor="agreeTerms" className="text-sm text-slate-600">
                      {isEnglish ? 'I agree to the ' : 'Acepto los '}
                      <Link href="#" className="underline">
                        {isEnglish ? 'Terms of Service' : 'Términos de servicio'}
                      </Link>
                      ,{' '}
                      <Link href="#" className="underline">
                        {isEnglish ? 'Privacy Policy' : 'Política de privacidad'}
                      </Link>
                      , {isEnglish ? 'and' : 'y'}{' '}
                      <Link href="#" className="underline">
                        {isEnglish ? 'Guest Refund Policy' : 'Política de reembolso para huéspedes'}
                      </Link>
                      .
                    </label>
                  </div>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-[12px] bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {error === 'taken'
                      ? copy.datesTaken
                      : error === 'missingDetails'
                        ? copy.missingDetails
                        : copy.checkoutFailed}
                  </p>
                )}

                <Button
                  type="submit"
                  // The guest details are in a form two sections up. Pointing at
                  // it by id makes this its submit button, which is what makes
                  // the browser check the required fields before we send
                  // anything — an onClick handler skips all of that.
                  form="checkout-form"
                  disabled={isLoading || !agreedToTerms || datesGone}
                  variant="brand"
                  size="lg"
                  className="mt-6 w-full text-base font-semibold shadow-[0_18px_50px_rgba(15,23,42,0.12)]"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      {isEnglish ? 'Processing...' : 'Procesando...'}
                    </span>
                  ) : (
                    <>{isEnglish ? 'Confirm and pay' : 'Confirmar y pagar'}</>
                  )}
                </Button>
              </div>
            </section>

            {/* Security Note */}
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="h-5 w-5 text-success mt-0.5" />
              <p>{copy.paymentSecurity}</p>
            </div>
          </div>

          {/* Right Column - Price Card */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <button
                type="button"
                onClick={() => setShowPriceBreakdown((prev) => !prev)}
                className="mb-3 flex w-full items-center justify-between rounded-[16px] border border-border bg-card px-4 py-3 lg:hidden"
              >
                <span className="text-sm font-semibold text-foreground">
                  {isEnglish ? 'Price details' : 'Detalle del precio'} · {currency(quote.total)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {showPriceBreakdown
                    ? isEnglish
                      ? 'Hide'
                      : 'Ocultar'
                    : isEnglish
                      ? 'Show'
                      : 'Mostrar'}
                </span>
              </button>
              <div className={showPriceBreakdown ? 'block' : 'hidden lg:block'}>
                <PriceBreakdownCard quote={quote} language={language} propertyPreview />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function CheckoutPage() {
  const { language } = useLanguage()
  const isEnglish = language === 'en'

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="mt-4 text-muted-foreground">
              {isEnglish ? 'Loading checkout...' : 'Cargando checkout...'}
            </p>
          </div>
        </div>
      }
    >
      <CheckoutForm />
    </Suspense>
  )
}
