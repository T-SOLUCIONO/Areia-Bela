'use client'

import { Suspense, useState } from 'react'
import { useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { format, parseISO, subDays } from 'date-fns'
import { Star, ShieldCheck, Clock, CreditCard } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Textarea } from '@areia-bela/ui/textarea'
import {
  currency,
  getQuoteFromStorage,
  fetchQuote,
  parseQuoteRequestFromSearchParams,
  saveQuoteToStorage,
  type BookingQuote,
} from '@/lib/booking'
import { propertyData } from '@/lib/property-data'
import { createCheckoutSession } from '@/services/payment'
import { useLanguage } from '@/components/language-provider'
import { PriceBreakdownCard } from '@/components/public/price-breakdown-card'
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
    void fetchQuote(request).then((priced) => {
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
  }, [request, router])

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
    if (!agreedToTerms) return

    setIsLoading(true)

    try {
      // Dates and extras only. The route re-prices them server-side and
      // charges that; no total is sent from here, because a total sent from a
      // browser is a total a browser can change.
      const session = await createCheckoutSession({
        checkIn: quote.checkIn,
        checkOut: quote.checkOut,
        adults: quote.guests.adults,
        children: quote.guests.children,
        infants: quote.guests.infants,
        pets: quote.guests.pets,
        extraIds: quote.extras.map((extra: BookingQuote['extras'][number]) => extra.id),
      })

      window.location.href = session.url
    } catch (error) {
      console.error('Checkout error:', error)
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

            {/* Guest Information */}
            <section className="space-y-4">
              <h2 className="font-serif text-xl text-foreground">
                {isEnglish ? 'Guest information' : 'Información del huésped'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* Payment */}
            <section className="space-y-4">
              <h2 className="font-serif text-xl text-foreground">
                {isEnglish ? 'Payment' : 'Pago'}
              </h2>
              <div className="rounded-xl border border-border p-5 bg-muted/40">
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {isEnglish ? 'Credit or debit card' : 'Tarjeta de crédito o débito'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Visa', 'Mastercard', 'Amex', 'Discover'].map((brand) => (
                    <span
                      key={brand}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground"
                    >
                      {brand}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium text-foreground">Total (USD)</span>
                  <span className="text-xl font-semibold text-foreground">
                    {currency(quote.total)}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="agreeTerms"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <label htmlFor="agreeTerms" className="text-sm text-muted-foreground">
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

                <Button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isLoading || !agreedToTerms}
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
              <p>
                {isEnglish
                  ? "Your booking is protected by AirCover. If there's a problem with your stay, we're here to help."
                  : 'Tu reserva está protegida por AirCover. Si hay un problema con tu estadía, estamos para ayudarte.'}
              </p>
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
