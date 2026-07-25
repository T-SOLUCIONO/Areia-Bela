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
        <div className="w-16 h-16 rounded-full bg-[#d4edda] flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-[#1b5e20]" />
        </div>
        <h1 className="text-2xl font-semibold text-[#222222] mb-2">
          {isEnglish ? 'Booking Confirmed!' : '¡Reserva confirmada!'}
        </h1>
        <p className="text-[#717171] mb-6">
          {isEnglish ? 'Loading your booking details...' : 'Cargando los detalles de tu reserva...'}
        </p>
        <div className="animate-pulse">
          <div className="h-8 w-8 rounded-full border-4 border-[#FF385C] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

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
      </header>*/}

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-12">
        {/* Success Message */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#d4edda] flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-[#1b5e20]" />
          </div>
          <h1 className="text-3xl font-semibold text-[#222222] mb-2">
            {isEnglish ? 'Booking Confirmed!' : '¡Reserva confirmada!'}
          </h1>
          <p className="text-[#717171] text-lg">
            {isEnglish
              ? 'Thanks, your reservation has been confirmed.'
              : 'Gracias, tu reserva ha sido confirmada.'}
          </p>
          {sessionId && (
            <p className="text-sm text-[#717171] mt-2">
              {isEnglish ? 'Confirmation ID' : 'ID de confirmación'}:{' '}
              <span className="font-mono text-xs">{sessionId.slice(0, 20)}...</span>
            </p>
          )}
        </div>

        {/* Booking Details Card */}
        <div className="rounded-2xl border border-[#ebebeb] p-6 md:p-8 mb-8">
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
              <h2 className="text-xl font-semibold text-[#222222] mb-2">{propertyData.name}</h2>
              <div className="flex items-center gap-1 text-[#717171] mb-4">
                <MapPin className="h-4 w-4" />
                <span>
                  {propertyData.city}, {propertyData.country}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <Calendar className="h-5 w-5 text-[#717171] mt-0.5" />
                  <div>
                    <p className="text-xs text-[#717171] uppercase tracking-wide">
                      {isEnglish ? 'Check-in' : 'Llegada'}
                    </p>
                    <p className="font-medium text-[#222222]">
                      {quote.checkIn ? format(parseISO(quote.checkIn), 'MMM d, yyyy') : 'N/A'}
                    </p>
                    <p className="text-sm text-[#717171]">
                      {isEnglish ? 'From 4:00 PM' : 'Desde las 4:00 PM'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-5 w-5 text-[#717171] mt-0.5" />
                  <div>
                    <p className="text-xs text-[#717171] uppercase tracking-wide">
                      {isEnglish ? 'Check-out' : 'Salida'}
                    </p>
                    <p className="font-medium text-[#222222]">
                      {quote.checkOut ? format(parseISO(quote.checkOut), 'MMM d, yyyy') : 'N/A'}
                    </p>
                    <p className="text-sm text-[#717171]">
                      {isEnglish ? 'By 10:00 AM' : 'Antes de las 10:00 AM'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#ebebeb] my-6" />

          {/* Guest Info */}
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-[#717171]" />
            <div>
              <p className="text-xs text-[#717171] uppercase tracking-wide">
                {isEnglish ? 'Guests' : 'Huéspedes'}
              </p>
              <p className="font-medium text-[#222222]">
                {quote.guests.adults + quote.guests.children} {isEnglish ? 'guest' : 'huésped'}
                {quote.guests.adults + quote.guests.children !== 1 ? (isEnglish ? 's' : 'es') : ''}
                {quote.guests.children > 0 &&
                  ` (${quote.guests.children} ${isEnglish ? 'children' : 'niños'})`}
              </p>
            </div>
          </div>

          {/* Nights */}
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#717171]" />
            <div>
              <p className="text-xs text-[#717171] uppercase tracking-wide">
                {isEnglish ? 'Duration' : 'Duración'}
              </p>
              <p className="font-medium text-[#222222]">
                {quote.nights} {isEnglish ? 'night' : 'noche'}
                {quote.nights !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Host Message */}
        <div className="rounded-2xl border border-[#ebebeb] p-6 md:p-8 mb-8 bg-[#fafafa]">
          <div className="flex items-start gap-4">
            <div className="relative h-12 w-12 rounded-full overflow-hidden flex-shrink-0">
              <Image
                src={propertyData.host.pictureUrl}
                alt={propertyData.host.name}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="font-semibold text-[#222222]">
                {isEnglish ? 'Message from' : 'Mensaje de'} {propertyData.host.firstName}
              </h3>
              <p className="text-[#717171] text-sm mt-1">
                {isEnglish
                  ? 'Thank you for choosing Areia Bela! We are excited to host you and make your stay unforgettable. If you have any questions before your arrival, do not hesitate to reach out. We cannot wait to welcome you!'
                  : '¡Gracias por elegir Areia Bela! Estamos emocionados de hospedarte y hacer que tu estadía sea inolvidable. Si tienes preguntas antes de tu llegada, no dudes en escribirnos. ¡No vemos la hora de recibirte!'}
              </p>
            </div>
          </div>
        </div>

        {/* Price Summary */}
        <div className="rounded-2xl border border-[#ebebeb] p-6 md:p-8 mb-8">
          <h3 className="font-semibold text-[#222222] mb-4">
            {isEnglish ? 'Price details' : 'Detalles del precio'}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-[#222222]">
              <span>
                {propertyData.pricing.price_per_night} x {quote.nights}{' '}
                {isEnglish ? 'nights' : 'noches'}
              </span>
              <span>${quote.subtotal.toLocaleString()}</span>
            </div>
            {quote.extrasTotal > 0 && (
              <div className="flex justify-between text-[#222222]">
                <span>{isEnglish ? 'Extras' : 'Extras'}</span>
                <span>${quote.extrasTotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-[#222222]">
              <span>{isEnglish ? 'Cleaning fee' : 'Tarifa de limpieza'}</span>
              <span>${quote.cleaningFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[#222222]">
              <span>{isEnglish ? 'Service fee' : 'Tarifa de servicio'}</span>
              <span>${quote.serviceFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[#222222]">
              <span>{isEnglish ? 'Taxes & fees' : 'Impuestos y tarifas'}</span>
              <span>${quote.taxes.toLocaleString()}</span>
            </div>
            <div className="h-px bg-[#ebebeb] my-3" />
            <div className="flex justify-between text-lg font-semibold text-[#222222]">
              <span>{isEnglish ? 'Total' : 'Total'}</span>
              <span>${quote.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Important Info */}
        <div className="rounded-2xl border border-[#ebebeb] p-6 md:p-8 mb-8">
          <div className="flex items-start gap-3 mb-6">
            <Shield className="h-6 w-6 text-[#717171] mt-0.5" />
            <div>
              <h3 className="font-semibold text-[#222222]">
                {isEnglish ? 'Booking Protection' : 'Protección de la reserva'}
              </h3>
              <p className="text-sm text-[#717171] mt-1">
                {isEnglish
                  ? "Your booking is protected by free AirCover. If there's a problem with your stay, we're here to help."
                  : 'Tu reserva está protegida por AirCover gratis. Si hay un problema con tu estadía, estamos para ayudarte.'}
              </p>
            </div>
          </div>

          <h3 className="font-semibold text-[#222222] mb-4">
            {isEnglish ? 'Guest controls' : 'Controles del huésped'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-sm text-[#717171]">
              <Mail className="h-4 w-4" />
              <span>
                {isEnglish
                  ? 'Confirmation email sent to your inbox'
                  : 'Correo de confirmación enviado a tu bandeja de entrada'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#717171]">
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
          <Button
            variant="outline"
            className="h-12 w-full border-[#222222] px-6 text-[#222222] hover:bg-[#f7f7f7] sm:w-auto"
          >
            <Download className="h-4 w-4" />
            {isEnglish ? 'Download receipt' : 'Descargar recibo'}
          </Button>
          <Button
            variant="outline"
            className="h-12 w-full border-[#222222] px-6 text-[#222222] hover:bg-[#f7f7f7] sm:w-auto"
          >
            <Share2 className="h-4 w-4" />
            {isEnglish ? 'Share trip details' : 'Compartir detalles del viaje'}
          </Button>
          <Button
            asChild
            className="h-12 w-full bg-[#FF385C] px-6 font-medium text-white hover:bg-[#E31C5F] sm:w-auto"
          >
            <Link href="/">{isEnglish ? 'Back to home' : 'Volver al inicio'}</Link>
          </Button>
        </div>

        {/* Need Help */}
        <div className="mt-8 text-center">
          <p className="text-sm text-[#717171]">
            {isEnglish ? 'Need help with your reservation?' : '¿Necesitas ayuda con tu reserva?'}{' '}
            <Link href="#" className="underline text-[#222222] hover:text-[#FF385C]">
              {isEnglish ? 'Contact us' : 'Contáctanos'}
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#ebebeb] py-6 px-6 md:px-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[#717171]">
          <p>
            &copy; {new Date().getFullYear()} Areia Bela.{' '}
            {isEnglish ? 'All rights reserved.' : 'Todos los derechos reservados.'}
          </p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-[#222222]">
              {isEnglish ? 'Privacy' : 'Privacidad'}
            </Link>
            <Link href="#" className="hover:text-[#222222]">
              {isEnglish ? 'Terms' : 'Términos'}
            </Link>
            <Link href="#" className="hover:text-[#222222]">
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
            <div className="h-16 w-16 rounded-full bg-[#d4edda] mb-4" />
            <div className="h-8 w-64 bg-[#ebebeb] rounded mb-2" />
            <div className="h-4 w-48 bg-[#ebebeb] rounded" />
          </div>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  )
}
