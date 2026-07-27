'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  Coffee,
  Gamepad2,
  MapPin,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  Umbrella,
  Users,
} from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@areia-bela/ui/dialog'
import { HomeHero } from '@/components/public/home-hero'
import { PhotoGallery } from '@/components/public/photo-gallery'
import { HouseDetails } from '@/components/public/house-details'
import { ContactSection } from '@/components/ContactSection'
import { ChatAssistant } from '@/components/chat/chat-assistant'
import { propertyInfo } from '@/lib/mock-data'
import { propertyData } from '@/lib/property-data'
import { RESPONSE_TIME_COMPACT } from '@/lib/host-response'
import { useLanguage } from '@/components/language-provider'
import { useSiteContent } from '@/components/public/site-content-provider'

const bundledImages = propertyData.photos?.map((photo) => photo.large) ?? propertyInfo.images

export default function HomePage() {
  const { language } = useLanguage()
  const siteContent = useSiteContent()

  // The gallery the host curates in /admin/content wins; the images bundled
  // from the original listing are the fallback for a cold or offline API.
  const galleryImages =
    siteContent && siteContent.images.length > 0
      ? siteContent.images.map((image) => image.url)
      : bundledImages
  const guest = propertyData.reviews[0]
  const featuredReviews = propertyData.reviews.slice(1, 4)
  const home =
    language === 'en'
      ? {
          galleryTitle: 'Thoughtful touches for an unforgettable stay',
          galleryCards: [
            {
              title: 'Coffee Bar',
              text: 'Start your day the beach way. Enjoy premium coffee, tea, and all the essentials.',
            },
            {
              title: 'Family Game Corner',
              text: 'Fun for all ages with board games, cards, and a cozy spot to connect and play.',
            },
            {
              title: 'Beach Essentials',
              text: "We've got you covered with beach chairs, towels, umbrella, cooler and more.",
            },
          ],
          amenitiesTitle: 'Everything you need, already in place.',
          amenitiesBody:
            'Clean, useful details that help guests decide faster without scanning a noisy block of icons.',
          showAllPhotos: 'Show all photos',
          reviewsIntro: 'Verified guests',
          reviewsTitle: 'What our guests say',
          locationTitle: "Where you'll be staying",
          locationSub: 'St. Petersburg, Florida, United States',
          nearbyTitle: 'Highlights nearby',
          nearby: [
            '5 min from Madeira Beach',
            "John's Pass Village & Boardwalk",
            'Local restaurants and cafés',
          ],
          directTitle: 'Direct booking',
          directBody:
            'Book direct for the best rate, clear communication, and a smoother stay from start to finish.',
          directCta: 'Book now',
          hostKicker: 'Your host',
          hostTitle: 'Meet Angélica',
          hostBadge: 'Superhost',
          hostBody:
            'Hi! I am Angélica, and I love sharing this beautiful corner of Florida with travelers from around the world. My mission is to make your stay perfect: from the first message to your last day.',
          contactHost: 'Contact Angélica',
          verified: 'Verified',
        }
      : {
          galleryTitle: 'Detalles pensados para una estadía inolvidable',
          galleryCards: [
            {
              title: 'Coffee Bar',
              text: 'Empieza el día con café premium, té y todo lo necesario.',
            },
            {
              title: 'Rincón de Juegos',
              text: 'Diversión para todas las edades con juegos de mesa, cartas y un espacio cómodo para compartir.',
            },
            {
              title: 'Esenciales de Playa',
              text: 'Incluye sillas, toallas, sombrilla, hielera y más para tu día de playa.',
            },
          ],
          amenitiesTitle: 'Todo lo que necesitas, ya está aquí.',
          amenitiesBody: 'Detalles útiles y claros que ayudan a decidir sin ruido visual.',
          showAllPhotos: 'Ver todas las fotos',
          reviewsIntro: 'Huéspedes verificados',
          reviewsTitle: 'Lo que dicen nuestros huéspedes',
          locationTitle: 'Dónde te quedarás',
          locationSub: 'St. Petersburg, Florida, Estados Unidos',
          nearbyTitle: 'Puntos cercanos',
          nearby: [
            'A 5 min de Madeira Beach',
            "John's Pass Village & Boardwalk",
            'Restaurantes y cafés locales',
          ],
          directTitle: 'Reserva directa',
          directBody:
            'Reserva directo para obtener la mejor tarifa, comunicación clara y una estadía más fluida de inicio a fin.',
          directCta: 'Reservar ahora',
          hostKicker: 'Tu anfitriona',
          hostTitle: 'Conoce a Angélica',
          hostBadge: 'Superanfitriona',
          hostBody:
            '¡Hola! Soy Angélica, y me encanta compartir este hermoso rincón de Florida con viajeros de todo el mundo. Mi misión es que tu estadía sea perfecta: desde el primer mensaje hasta el último día.',
          contactHost: 'Contactar a Angélica',
          verified: 'Verificado',
        }

  return (
    <div className="bg-background text-foreground">
      <HomeHero images={galleryImages} />

      <section id="gallery" className="relative overflow-hidden py-10 sm:py-12 lg:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_32%),linear-gradient(180deg,rgba(247,242,234,0.96)_0%,rgba(247,242,234,0.9)_100%)]" />

        <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto mb-4 h-px w-12 bg-[#174d7a]/30" />
            <h2 className="font-serif text-3xl tracking-tight text-[#173a57] sm:text-4xl">
              {home.galleryTitle}
            </h2>
          </div>

          <div className="relative mt-8">
            <PhotoGallery
              photos={propertyData.photos}
              propertyName={propertyData.name}
              showAllLabel={home.showAllPhotos}
            />
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {[
              { image: galleryImages[1] ?? galleryImages[0], icon: Coffee },
              { image: galleryImages[2] ?? galleryImages[0], icon: Gamepad2 },
              { image: galleryImages[3] ?? galleryImages[0], icon: Umbrella },
            ].map((card, index) => {
              const Icon = card.icon
              return (
                <article
                  key={home.galleryCards[index].title}
                  className="overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    <Image
                      src={card.image}
                      alt={home.galleryCards[index].title}
                      fill
                      className="object-cover transition-transform duration-700 hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-[#174d7a]">
                      <Icon className="h-5 w-5" />
                      <h3 className="font-serif text-2xl text-[#173a57]">
                        {home.galleryCards[index].title}
                      </h3>
                    </div>
                    <p className="mt-3 text-[15px] leading-7 text-slate-600">
                      {home.galleryCards[index].text}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="amenities" className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#174d7a]">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                  {language === 'en' ? 'Amenities' : 'Servicios'}
                </span>
              </div>
              <h2 className="mt-3 font-serif text-3xl text-[#173a57] sm:text-4xl">
                {home.amenitiesTitle}
              </h2>
            </div>
            <p className="max-w-xl text-[15px] leading-7 text-slate-600">{home.amenitiesBody}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {propertyInfo.amenities.slice(0, 18).map((amenity) => (
              <span
                key={amenity}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700"
              >
                {amenity}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="reviews" className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-amber-600">
              {home.reviewsIntro}
            </p>
            <h2 className="font-serif text-4xl text-[#173a57]">{home.reviewsTitle}</h2>
          </div>

          <div className="flex shrink-0 items-center gap-5 rounded-[24px] bg-[#f8f5f0] px-6 py-4">
            <div className="text-center">
              <p className="font-serif text-5xl leading-none text-[#173a57]">
                {propertyData.rating.toFixed(1)}
              </p>
              <div className="mt-1.5 flex justify-center gap-0.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-amber-500 text-amber-500" />
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {propertyData.reviewsCount} {language === 'en' ? 'reviews' : 'reseñas'}
              </p>
            </div>

            <div className="space-y-1.5 border-l border-gray-200 pl-5">
              {[
                { label: language === 'en' ? 'Cleanliness' : 'Limpieza', val: 99 },
                { label: language === 'en' ? 'Communication' : 'Comunicación', val: 100 },
                { label: language === 'en' ? 'Location' : 'Ubicación', val: 98 },
                { label: language === 'en' ? 'Value' : 'Valor', val: 97 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-24 text-xs text-gray-500">{item.label}</span>
                  <div className="h-1 w-20 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-[#173a57]"
                      style={{ width: `${item.val}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{(item.val / 20).toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 mb-8 overflow-hidden rounded-[32px] bg-[#173a57] p-8 relative md:p-10">
          <Quote className="absolute left-6 top-6 h-16 w-16 text-white/10" />
          <div className="relative z-10 md:flex md:items-start md:gap-8">
            <div className="flex-1">
              <div className="mb-4 flex gap-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-5 w-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="mb-6 text-lg leading-relaxed text-white md:text-xl">
                {language === 'en'
                  ? '"Absolutely perfect. The house was spotless, beautifully decorated, and had everything we needed for a relaxing family vacation. The pool was amazing and the beach was just minutes away. We will definitely be back!"'
                  : '"Absolutamente perfecto. La casa estaba impecable, bellamente decorada y tenía todo lo que necesitábamos para unas vacaciones familiares relajantes. La piscina fue increíble y la playa estaba a solo minutos. ¡Definitivamente volveremos!"'}
              </p>
              <div className="flex items-center gap-3">
                {guest?.author?.pictureUrl ? (
                  <Image
                    src={guest.author.pictureUrl}
                    alt={guest.author.firstName ?? ''}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full border-2 border-white/30 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-white">
                    <Star className="h-6 w-6 fill-current" />
                  </div>
                )}
                <div>
                  <p className="text-white">- {guest?.author?.firstName ?? 'Guest'}</p>
                  <p className="flex items-center gap-1 text-sm text-blue-300">
                    <ShieldCheck className="h-3.5 w-3.5" />{' '}
                    {language === 'en' ? 'Verified stay' : 'Estadía verificada'}
                    {guest?.localizedDate ? ` · ${guest.localizedDate}` : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featuredReviews.map((review) => (
            <article
              key={review.id}
              className="flex flex-col gap-4 rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-0.5">
                  {Array.from({ length: review.rating }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                {review.localizedDate && (
                  <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-400">
                    {review.localizedDate}
                  </span>
                )}
              </div>
              <p className="flex-1 text-sm leading-relaxed text-gray-700">
                &quot;{review.comments}&quot;
              </p>
              <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
                {review.author?.pictureUrl ? (
                  <Image
                    src={review.author.pictureUrl}
                    alt={review.author.firstName ?? ''}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-[#173a57]">
                    <Users className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[#173a57]">
                    {review.author?.firstName ??
                      (language === 'en' ? 'Verified guest' : 'Huésped verificado')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-[11px] text-gray-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                  {home.verified}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Everything below the reviews is editable from /admin/content. */}
      <HouseDetails />

      <section id="location" className="mx-auto max-w-[1440px] px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.75fr]">
          <div>
            <h2 className="font-serif text-3xl text-[#173a57] sm:text-4xl">{home.locationTitle}</h2>
            <p className="mt-2 text-slate-600">{home.locationSub}</p>

            <div className="mt-6 overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="relative h-[360px] w-full sm:h-[480px]">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3528.27419102434!2d-82.78821252441964!3d27.816251620242203!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88c2fd15ebc9ec1f%3A0xea5d3d7f3368a9aa!2sAreia%20Bela!5e0!3m2!1sen!2sus!4v1710128828956!5m2!1sen!2sus"
                  className="h-full w-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Areia Bela map"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-end space-y-4">
            <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <h3 className="font-serif text-2xl text-[#173a57]">{home.nearbyTitle}</h3>
              <div className="mt-4 space-y-4">
                {home.nearby.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <MapPin className="h-4 w-4 text-[#174d7a]" />
                    <span className="text-sm text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-[#174d7a] p-6 text-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
              <div className="flex items-center gap-2 text-white/80">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                  {home.directTitle}
                </span>
              </div>
              <p className="mt-3 text-[15px] leading-7 text-white/85">{home.directBody}</p>
              <Button
                asChild
                className="mt-5 h-11 rounded-full bg-white px-5 font-semibold text-[#174d7a] hover:bg-white/90"
              >
                <Link href="#reservar">{home.directCta}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-[#e8f4f8] to-white py-7">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs uppercase tracking-widest text-amber-600">
              {home.hostKicker}
            </p>
            <h2 className="font-serif text-4xl text-[#173a57]">{home.hostTitle}</h2>
          </div>

          <div className="mx-auto max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-xl">
            <div className="md:flex">
              <div className="relative shrink-0 md:w-64">
                <div className="relative h-64 overflow-hidden md:h-full">
                  <Image
                    src={propertyData.host.pictureUrl}
                    alt={propertyData.host.name}
                    width={400}
                    height={400}
                    className="h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#173a57]/40 to-transparent" />
                  {propertyData.host.isSuperhost && (
                    <div className="absolute bottom-4 left-4">
                      <span className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs text-[#173a57] backdrop-blur-sm">
                        <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                        {home.hostBadge}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 p-8">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-serif text-2xl text-[#173a57]">
                      {propertyData.host.firstName}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
                      <Sparkles className="h-3.5 w-3.5" />{' '}
                      {language === 'en' ? 'Host since' : 'Anfitriona desde'}{' '}
                      {propertyData.hostSinceYear}
                    </p>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                </div>

                <p className="mb-6 text-sm leading-relaxed text-gray-600">{home.hostBody}</p>

                <div className="mb-6 grid grid-cols-3 gap-4">
                  {[
                    {
                      icon: <Star className="h-4 w-4 fill-amber-500 text-amber-500" />,
                      value: `${propertyData.reviewsCount}+`,
                      label: language === 'en' ? 'Reviews' : 'Reseñas',
                    },
                    {
                      icon: <ShieldCheck className="h-4 w-4 text-[#173a57]" />,
                      value: RESPONSE_TIME_COMPACT[language][propertyData.hostResponseTime],
                      label: language === 'en' ? 'Response' : 'Respuesta',
                    },
                    {
                      icon: <Sparkles className="h-4 w-4 text-green-500" />,
                      value: propertyData.host.responseRateWithoutNa ?? '—',
                      label: language === 'en' ? 'Response rate' : 'Tasa de respuesta',
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-[#f8f5f0] px-2 py-3 text-center">
                      <div className="mb-1 flex justify-center">{item.icon}</div>
                      <p className="text-sm text-[#173a57]">{item.value}</p>
                      <p className="text-[11px] text-gray-400">{item.label}</p>
                    </div>
                  ))}
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="brand" size="lg" className="w-full font-semibold">
                      <Quote className="h-4 w-4" /> {home.contactHost}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-none bg-transparent p-0 shadow-none [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-white [&>button]:p-1.5 [&>button]:opacity-100 [&>button]:shadow-md">
                    <DialogTitle className="sr-only">{home.contactHost}</DialogTitle>
                    <ContactSection />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ChatAssistant />
    </div>
  )
}
