'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import {
  CheckCircle,
  Calendar,
  Users,
  MapPin,
  Mail,
  Clock,
  Download,
  Share2,
  Shield,
} from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { getQuoteFromStorage } from '@/lib/booking'
import { propertyData } from '@/lib/property-data'
import type { BookingQuote } from '@/lib/booking'
import { useLanguage } from '@/components/language-provider'

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { language } = useLanguage()
  const isEnglish = language === 'en'
  const [quote, setQuote] = useState<BookingQuote | null>(null)

  useEffect(() => {
    const storedQuote = getQuoteFromStorage()
    if (storedQuote) {
      setQuote(storedQuote)
    }
  }, [])

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
        <h1 className="font-serif text-3xl text-foreground mb-2">
          {isEnglish ? 'Booking Confirmed!' : '¡Reserva confirmada!'}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isEnglish ? 'Loading your booking details...' : 'Cargando los detalles de tu reserva...'}
        </p>
        <div className="animate-pulse">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-12">
        {/* Success Message */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-success" />
          </div>
          <h1 className="font-serif text-3xl text-foreground mb-2">
            {isEnglish ? 'Booking Confirmed!' : '¡Reserva confirmada!'}
          </h1>
          <p className="text-muted-foreground text-lg">
            {isEnglish
              ? 'Thanks, your reservation has been confirmed.'
              : 'Gracias, tu reserva ha sido confirmada.'}
          </p>
          {sessionId && (
            <p className="text-sm text-muted-foreground mt-2">
              {isEnglish ? 'Confirmation ID' : 'ID de confirmación'}:{' '}
              <span className="font-mono text-xs">{sessionId.slice(0, 20)}...</span>
            </p>
          )}
        </div>

        {/* Booking Details Card */}
        <div className="rounded-2xl border border-border p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Property Image */}
            <div className="relative h-40 w-full md:w-48 flex-shrink-0 rounded-xl overflow-hidden">
              <Image
                src={propertyData.photos[0].large}
                alt={propertyData.name}
                fill
                className="object-cover"
              />
            </div>

            {/* Property Info */}
            <div className="flex-1">
              <h2 className="font-serif text-xl text-foreground mb-2">{propertyData.name}</h2>
              <div className="flex items-center gap-1 text-muted-foreground mb-4">
                <MapPin className="h-4 w-4" />
                <span>
                  {propertyData.city}, {propertyData.country}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {isEnglish ? 'Check-in' : 'Llegada'}
                    </p>
                    <p className="font-medium text-foreground">
                      {quote.checkIn ? format(parseISO(quote.checkIn), 'MMM d, yyyy') : 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isEnglish ? 'From 4:00 PM' : 'Desde las 4:00 PM'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {isEnglish ? 'Check-out' : 'Salida'}
                    </p>
                    <p className="font-medium text-foreground">
                      {quote.checkOut ? format(parseISO(quote.checkOut), 'MMM d, yyyy') : 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isEnglish ? 'By 10:00 AM' : 'Antes de las 10:00 AM'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border my-6" />

          {/* Guest Info */}
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {isEnglish ? 'Guests' : 'Huéspedes'}
              </p>
              <p className="font-medium text-foreground">
                {quote.guests.adults + quote.guests.children} {isEnglish ? 'guest' : 'huésped'}
                {quote.guests.adults + quote.guests.children !== 1 ? (isEnglish ? 's' : 'es') : ''}
                {quote.guests.children > 0 &&
                  ` (${quote.guests.children} ${isEnglish ? 'children' : 'niños'})`}
              </p>
            </div>
          </div>

          {/* Nights */}
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {isEnglish ? 'Duration' : 'Duración'}
              </p>
              <p className="font-medium text-foreground">
                {quote.nights} {isEnglish ? 'night' : 'noche'}
                {quote.nights !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Host Message */}
        <div className="mb-8 rounded-[24px] border border-border bg-secondary p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white">
              <Image
                src={propertyData.host.pictureUrl}
                alt={propertyData.host.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-foreground">
                  {isEnglish ? 'Message from' : 'Mensaje de'} {propertyData.host.firstName}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {isEnglish ? 'Just now' : 'Justo ahora'}
                </span>
              </div>
              <div className="mt-2 rounded-[18px] rounded-tl-sm bg-card px-4 py-3 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  {isEnglish
                    ? 'Thank you for choosing Areia Bela! We are excited to host you and make your stay unforgettable. If you have any questions before your arrival, do not hesitate to reach out. We cannot wait to welcome you!'
                    : '¡Gracias por elegir Areia Bela! Estamos emocionados de hospedarte y hacer que tu estadía sea inolvidable. Si tienes preguntas antes de tu llegada, no dudes en escribirnos. ¡No vemos la hora de recibirte!'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Price Summary */}
        <div className="rounded-2xl border border-border p-6 md:p-8 mb-8">
          <h3 className="font-serif text-lg text-foreground mb-4">
            {isEnglish ? 'Price details' : 'Detalles del precio'}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-foreground">
              <span>
                {propertyData.pricing.price_per_night} x {quote.nights}{' '}
                {isEnglish ? 'nights' : 'noches'}
              </span>
              <span>${quote.subtotal.toLocaleString()}</span>
            </div>
            {quote.extrasTotal > 0 && (
              <div className="flex justify-between text-foreground">
                <span>{isEnglish ? 'Extras' : 'Extras'}</span>
                <span>${quote.extrasTotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-foreground">
              <span>{isEnglish ? 'Cleaning fee' : 'Tarifa de limpieza'}</span>
              <span>${quote.cleaningFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-foreground">
              <span>{isEnglish ? 'Service fee' : 'Tarifa de servicio'}</span>
              <span>${quote.serviceFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-foreground">
              <span>{isEnglish ? 'Taxes & fees' : 'Impuestos y tarifas'}</span>
              <span>${quote.taxes.toLocaleString()}</span>
            </div>
            <div className="h-px bg-border my-3" />
            <div className="flex justify-between text-lg font-semibold text-foreground">
              <span>{isEnglish ? 'Total' : 'Total'}</span>
              <span>${quote.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Important Info */}
        <div className="rounded-2xl border border-border p-6 md:p-8 mb-8">
          <div className="flex items-start gap-3 mb-6">
            <Shield className="h-6 w-6 text-muted-foreground mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground">
                {isEnglish ? 'Booking Protection' : 'Protección de la reserva'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isEnglish
                  ? "Your booking is protected by free AirCover. If there's a problem with your stay, we're here to help."
                  : 'Tu reserva está protegida por AirCover gratis. Si hay un problema con tu estadía, estamos para ayudarte.'}
              </p>
            </div>
          </div>

          <h3 className="font-serif text-lg text-foreground mb-4">
            {isEnglish ? 'Guest controls' : 'Controles del huésped'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>
                {isEnglish
                  ? 'Confirmation email sent to your inbox'
                  : 'Correo de confirmación enviado a tu bandeja de entrada'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {isEnglish
                  ? 'Add to calendar feature available'
                  : 'Función de agregar al calendario disponible'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" size="lg" className="w-full px-6 sm:w-auto">
            <Download className="h-4 w-4" />
            {isEnglish ? 'Download receipt' : 'Descargar recibo'}
          </Button>
          <Button variant="outline" size="lg" className="w-full px-6 sm:w-auto">
            <Share2 className="h-4 w-4" />
            {isEnglish ? 'Share trip details' : 'Compartir detalles del viaje'}
          </Button>
          <Button asChild variant="brand" size="lg" className="w-full px-6 font-medium sm:w-auto">
            <Link href="/">{isEnglish ? 'Back to home' : 'Volver al inicio'}</Link>
          </Button>
        </div>

        {/* Need Help */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            {isEnglish ? 'Need help with your reservation?' : '¿Necesitas ayuda con tu reserva?'}{' '}
            <Link href="#" className="underline text-foreground hover:text-primary">
              {isEnglish ? 'Contact us' : 'Contáctanos'}
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6 md:px-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Areia Bela.{' '}
            {isEnglish ? 'All rights reserved.' : 'Todos los derechos reservados.'}
          </p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-foreground">
              {isEnglish ? 'Privacy' : 'Privacidad'}
            </Link>
            <Link href="#" className="hover:text-foreground">
              {isEnglish ? 'Terms' : 'Términos'}
            </Link>
            <Link href="#" className="hover:text-foreground">
              {isEnglish ? 'Sitemap' : 'Mapa del sitio'}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-success/15 mb-4" />
            <div className="h-8 w-64 bg-border rounded mb-2" />
            <div className="h-4 w-48 bg-border rounded" />
          </div>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  )
}
