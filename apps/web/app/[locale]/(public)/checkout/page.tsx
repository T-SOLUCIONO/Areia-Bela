'use client'

import { Suspense, useState } from 'react'
import { useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { format, parseISO, subDays } from 'date-fns'
import { Star, Shield, ShieldCheck, Clock, CreditCard, Info } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Textarea } from '@areia-bela/ui/textarea'
import {
  currency,
  getQuoteFromStorage,
  parseQuoteFromSearchParams,
  saveQuoteToStorage,
} from '@/lib/booking'
import { propertyData } from '@/lib/property-data'
import { createCheckoutSession } from '@/services/payment'
import { useLanguage } from '@/components/language-provider'

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
  const quoteFromParams = useMemo(
    () => parseQuoteFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )
  const [quote, setQuote] = useState(quoteFromParams)
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

  const text = isEnglish
    ? {
        loading: 'Loading your reservation...',
        backHome: 'Back to home',
        title: 'Confirm and pay',
        yourTrip: 'Your trip',
        dates: 'Dates',
        guests: 'Guests',
        nights: 'nights',
        freeCancellation: 'Free cancellation',
        cancellationCopy:
          'Cancel before {date} for a partial refund. After that, cancel before check-in to get a 50% refund, minus the service fee.',
        messageHost: 'Message the host',
        hostedBy: 'Hosted by',
        hostSince: 'Host since',
        requestPlaceholder: "Let the host know a little about yourself and why you're traveling...",
        refundPolicy: 'guest refund policy',
        guestInformation: 'Guest information',
        firstName: 'First name',
        lastName: 'Last name',
        email: 'Email address',
        phone: 'Phone number',
        country: 'Country/Region',
        payment: 'Payment',
        card: 'Credit or debit card',
        terms: 'I agree to the Terms of Service, Privacy Policy, and Guest Refund Policy.',
        confirmPay: 'Confirm and pay',
        processing: 'Processing...',
        protected:
          'Your booking is protected by AirCover. If there is a problem with your stay, we are here to help.',
        receipt: 'Download receipt',
        share: 'Share trip details',
        home: 'Back to home',
        help: 'Need help with your reservation?',
        contact: 'Contact us',
        loadingCheckout: 'Loading checkout...',
        bookingConfirmed: 'Booking Confirmed!',
      }
    : {
        loading: 'Cargando tu reserva...',
        backHome: 'Volver al inicio',
        title: 'Confirmar y pagar',
        yourTrip: 'Tu viaje',
        dates: 'Fechas',
        guests: 'Huéspedes',
        nights: 'noches',
        freeCancellation: 'Cancelación gratuita',
        cancellationCopy:
          'Cancela antes de {date} para un reembolso parcial. Después de eso, cancela antes del check-in para obtener un reembolso del 50%, menos la tarifa de servicio.',
        messageHost: 'Mensaje al anfitrión',
        hostedBy: 'Anfitrión',
        hostSince: 'Anfitrión desde',
        requestPlaceholder: 'Cuéntale al anfitrión un poco sobre ti y por qué viajas...',
        refundPolicy: 'política de reembolso para huéspedes',
        guestInformation: 'Información del huésped',
        firstName: 'Nombre',
        lastName: 'Apellido',
        email: 'Correo electrónico',
        phone: 'Número de teléfono',
        country: 'País/Región',
        payment: 'Pago',
        card: 'Tarjeta de crédito o débito',
        terms:
          'Acepto los Términos de servicio, la Política de privacidad y la Política de reembolso para huéspedes.',
        confirmPay: 'Confirmar y pagar',
        processing: 'Procesando...',
        protected:
          'Tu reserva está protegida por AirCover. Si hay un problema con tu estadía, estamos para ayudarte.',
        receipt: 'Descargar recibo',
        share: 'Compartir detalles del viaje',
        home: 'Volver al inicio',
        help: '¿Necesitas ayuda con tu reserva?',
        contact: 'Contáctanos',
        loadingCheckout: 'Cargando checkout...',
        bookingConfirmed: 'Reserva confirmada!',
      }

  useEffect(() => {
    if (quoteFromParams) {
      setQuote(quoteFromParams)
      saveQuoteToStorage(quoteFromParams)
      return
    }
    const persisted = getQuoteFromStorage()
    if (persisted) {
      setQuote(persisted)
      return
    }
    router.replace('/')
  }, [quoteFromParams, router])

  if (!quote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 rounded-full border-4 border-[#FF385C] border-t-transparent animate-spin" />
          <p className="mt-4 text-[#717171]">
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
      const session = await createCheckoutSession({
        roomId: propertyData.id,
        roomName: propertyData.name,
        roomType: 'casa',
        checkIn: quote.checkIn,
        checkOut: quote.checkOut,
        guests: quote.guests.adults + quote.guests.children,
        adults: quote.guests.adults,
        children: quote.guests.children,
        nights: quote.nights,
        nightPrice: quote.pricePerNight,
        cleaningFee: quote.cleaningFee,
        serviceFee: quote.serviceFee,
        taxes: quote.taxes,
        totalPrice: quote.total,
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
  const hasDiscount = quote.originalPricePerNight > quote.pricePerNight
  const savings = hasDiscount
    ? (quote.originalPricePerNight - quote.pricePerNight) * quote.nights
    : 0

  return (
    <div className="min-h-screen bg-white">
      {/* Header 
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#ebebeb] bg-white px-6 md:px-12">
        <Link href="/" className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2zm0 4a3 3 0 110 6 3 3 0 010-6zm0 22c-6.627 0-12-5.373-12-12h4c0 4.418 3.582 8 8 8s8-3.582 8-8h4c0 6.627-5.373 12-12 12z" fill="#FF385C"/>
          </svg>
          <span className="font-semibold text-xl text-[#222222]">areia bela</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-sm text-[#717171]">
            <Shield className="h-4 w-4 text-[#008A05]" />
            <span>{isEnglish ? 'Booking protected' : 'Reserva protegida'}</span>
          </div>
        </div>
      </header>*/}

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-12">
        <Button
          asChild
          variant="ghost"
          className="mb-6 h-10 rounded-full px-3 text-sm text-[#717171] hover:bg-[#fafafa] hover:text-[#222222]"
        >
          <Link href="/">← {isEnglish ? 'Back to home' : 'Volver al inicio'}</Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left Column - Form */}
          <div className="lg:col-span-3 space-y-8">
            {/* Header Section */}
            <div className="border-b border-[#ebebeb] pb-6">
              <h1 className="text-2xl font-semibold text-[#222222]">
                {isEnglish ? 'Confirm and pay' : 'Confirmar y pagar'}
              </h1>
            </div>

            {/* Property Card */}
            <div className="rounded-xl border border-[#ebebeb] p-5">
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
                  <p className="font-semibold text-[#222222]">{propertyData.name}</p>
                  <p className="text-sm text-[#717171] mt-1">
                    {propertyData.city}, {propertyData.country}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <Star className="h-4 w-4 fill-[#222222] text-[#222222]" />
                    <span className="font-medium text-[#222222]">
                      {propertyData.rating.toFixed(2)}
                    </span>
                    <span className="text-[#717171]">
                      ({propertyData.reviewsCount} {isEnglish ? 'reviews' : 'reseñas'})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trip Details */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-[#222222]">
                {isEnglish ? 'Your trip' : 'Tu viaje'}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#ebebeb] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#717171]">
                    {isEnglish ? 'Dates' : 'Fechas'}
                  </p>
                  <p className="mt-1 font-medium text-[#222222]">
                    {format(parseISO(quote.checkIn), 'MMM d')} -{' '}
                    {format(parseISO(quote.checkOut), 'MMM d, yyyy')}
                  </p>
                  <p className="text-sm text-[#717171]">{quote.nights} nights</p>
                </div>
                <div className="rounded-lg border border-[#ebebeb] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#717171]">
                    {isEnglish ? 'Guests' : 'Huéspedes'}
                  </p>
                  <p className="mt-1 font-medium text-[#222222]">
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
            <section className="rounded-xl border border-[#ebebeb] p-5 bg-[#fafafa]">
              <div className="flex items-start gap-4">
                <Clock className="h-6 w-6 text-[#717171] mt-0.5" />
                <div>
                  <p className="font-semibold text-[#222222]">
                    {isEnglish ? 'Free cancellation' : 'Cancelación gratuita'}
                  </p>
                  <p className="text-sm text-[#717171] mt-1">
                    {isEnglish
                      ? `Cancel before ${cancellationDate} for a partial refund. After that, cancel before check-in to get a 50% refund, minus the service fee.`
                      : `Cancela antes del ${cancellationDate} para un reembolso parcial. Después de eso, cancela antes del check-in para obtener un reembolso del 50%, menos la tarifa de servicio.`}
                  </p>
                </div>
              </div>
            </section>

            {/* Message to Host */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-[#222222]">
                {isEnglish ? 'Message the host' : 'Mensaje al anfitrión'}
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-full">
                  <Image
                    src={propertyData.host.pictureUrl}
                    alt={propertyData.host.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-[#222222]">
                    {isEnglish ? 'Hosted by' : 'Anfitrión'} {propertyData.host.firstName}
                  </p>
                  <p className="text-sm text-[#717171]">
                    {isEnglish ? 'Host since' : 'Anfitrión desde'} {propertyData.hostSinceYear}
                  </p>
                </div>
              </div>
              <Textarea
                id="specialRequests"
                name="specialRequests"
                value={formData.specialRequests}
                onChange={handleInputChange}
                placeholder={
                  isEnglish
                    ? "Let the host know a little about yourself and why you're traveling..."
                    : 'Cuéntale al anfitrión un poco sobre ti y por qué viajas...'
                }
                rows={4}
                className="rounded-lg border-[#b0b0b0] resize-none"
              />
              <p className="text-sm text-[#717171]">
                {isEnglish
                  ? "By messaging the host, you agree to the host's house rules and the "
                  : 'Al enviar un mensaje al anfitrión, aceptas las reglas de la casa y la '}
                <Link href="#" className="underline">
                  {isEnglish ? 'guest refund policy' : 'política de reembolso para huéspedes'}
                </Link>
                .
              </p>
            </section>

            {/* Guest Information */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-[#222222]">
                {isEnglish ? 'Guest information' : 'Información del huésped'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="firstName" className="text-sm font-medium text-[#222222]">
                      {isEnglish ? 'First name' : 'Nombre'}
                    </Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="rounded-lg border-[#b0b0b0]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName" className="text-sm font-medium text-[#222222]">
                      {isEnglish ? 'Last name' : 'Apellido'}
                    </Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="rounded-lg border-[#b0b0b0]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-sm font-medium text-[#222222]">
                    {isEnglish ? 'Email address' : 'Correo electrónico'}
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="rounded-lg border-[#b0b0b0]"
                  />
                  <p className="text-xs text-[#717171]">
                    {isEnglish
                      ? 'Confirmation will be sent to this email'
                      : 'La confirmación se enviará a este correo'}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-sm font-medium text-[#222222]">
                    {isEnglish ? 'Phone number' : 'Número de teléfono'}
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="rounded-lg border-[#b0b0b0]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="country" className="text-sm font-medium text-[#222222]">
                    {isEnglish ? 'Country/Region' : 'País/Región'}
                  </Label>
                  <select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-[#b0b0b0] px-3 py-2 text-sm"
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
              <h2 className="text-lg font-semibold text-[#222222]">
                {isEnglish ? 'Payment' : 'Pago'}
              </h2>
              <div className="rounded-xl border border-[#ebebeb] p-5 bg-[#fafafa]">
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="h-5 w-5 text-[#717171]" />
                  <span className="text-[#717171]">
                    {isEnglish ? 'Credit or debit card' : 'Tarjeta de crédito o débito'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Visa', 'Mastercard', 'Amex', 'Discover'].map((brand) => (
                    <span
                      key={brand}
                      className="rounded-md border border-[#b0b0b0] bg-white px-3 py-1.5 text-xs font-medium text-[#222222]"
                    >
                      {brand}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#ebebeb] p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium text-[#222222]">Total (USD)</span>
                  <span className="text-xl font-semibold text-[#222222]">
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
                      className="h-4 w-4 rounded border-[#b0b0b0] accent-[#FF385C]"
                    />
                    <label htmlFor="agreeTerms" className="text-sm text-[#717171]">
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
                  className="mt-6 w-full h-14 rounded-lg bg-[#FF385C] hover:bg-[#E31C5F] text-white font-semibold text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="flex items-start gap-3 text-sm text-[#717171]">
              <ShieldCheck className="h-5 w-5 text-[#008A05] mt-0.5" />
              <p>
                {isEnglish
                  ? "Your booking is protected by AirCover. If there's a problem with your stay, we're here to help."
                  : 'Tu reserva está protegida por AirCover. Si hay un problema con tu estadía, estamos para ayudarte.'}
              </p>
            </div>
          </div>

          {/* Right Column - Price Card */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 rounded-xl border border-[#dddddd] bg-white p-6 shadow-lg">
              {/* Property Preview */}
              <div className="flex gap-4 pb-5 border-b border-[#ebebeb]">
                <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={propertyData.photos[0].large}
                    alt={propertyData.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-[#222222] line-clamp-2">{propertyData.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-3.5 w-3.5 fill-[#222222] text-[#222222]" />
                    <span className="text-sm font-medium">{propertyData.rating.toFixed(2)}</span>
                    <span className="text-sm text-[#717171]">({propertyData.reviewsCount})</span>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="py-5 border-b border-[#ebebeb] space-y-3">
                <div className="flex justify-between items-center">
                  <span className="underline text-[#222222]">
                    {currency(quote.pricePerNight)} x {quote.nights}{' '}
                    {isEnglish ? 'nights' : 'noches'}
                  </span>
                  <span className="text-[#222222]">{currency(quote.subtotal)}</span>
                </div>

                {hasDiscount && savings > 0 && (
                  <div className="flex justify-between items-center text-[#1b5e20]">
                    <span className="underline">
                      {isEnglish ? 'Weekly discount' : 'Descuento semanal'}
                    </span>
                    <span>-{currency(savings)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="underline text-[#222222]">
                    {isEnglish ? 'Cleaning fee' : 'Tarifa de limpieza'}
                  </span>
                  <span className="text-[#222222]">{currency(quote.cleaningFee)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="underline text-[#222222]">
                    {isEnglish ? 'Service fee' : 'Tarifa de servicio'}
                  </span>
                  <span className="text-[#222222]">{currency(quote.serviceFee)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="underline text-[#222222]">
                    {isEnglish ? 'Taxes & fees' : 'Impuestos y tarifas'}
                  </span>
                  <span className="text-[#222222]">{currency(quote.taxes)}</span>
                </div>
              </div>

              {/* Total */}
              <div className="pt-5">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-[#222222]">
                    {isEnglish ? 'Total (USD)' : 'Total (USD)'}
                  </span>
                  <span className="text-xl font-semibold text-[#222222]">
                    {currency(quote.total)}
                  </span>
                </div>
              </div>

              {/* Cancellation Policy in Card */}
              <div className="mt-5 p-4 rounded-lg bg-[#fafafa]">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-[#717171] mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#222222]">
                      {isEnglish ? 'Free cancellation' : 'Cancelación gratuita'}
                    </p>
                    <p className="text-sm text-[#717171] mt-1">
                      Cancel before {cancellationDate} for a partial refund.
                    </p>
                  </div>
                </div>
              </div>

              {/* Price Tip */}
              {hasDiscount && savings > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-[#d4edda] flex items-start gap-2">
                  <Info className="h-4 w-4 text-[#1b5e20] mt-0.5" />
                  <p className="text-sm text-[#1b5e20]">
                    You&apos;re saving <span className="font-semibold">{currency(savings)}</span>{' '}
                    with this discount!
                  </p>
                </div>
              )}
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
            <div className="h-8 w-8 rounded-full border-4 border-[#FF385C] border-t-transparent animate-spin" />
            <p className="mt-4 text-[#717171]">Loading checkout...</p>
          </div>
        </div>
      }
    >
      <CheckoutForm />
    </Suspense>
  )
}
