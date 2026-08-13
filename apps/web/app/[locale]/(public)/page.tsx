'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Quote, ShieldCheck, Sparkles, Star, Users } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@areia-bela/ui/dialog'
import { HomeHero } from '@/components/public/home-hero'
import { PhotoGallery } from '@/components/public/photo-gallery'
import { HouseDetails } from '@/components/public/house-details'
import { ContactSection } from '@/components/ContactSection'
import { propertyInfo } from '@/lib/mock-data'
import { propertyData } from '@/lib/property-data'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/lib/i18n'
import { useSiteContent } from '@/components/public/site-content-provider'
import { itemsOf } from '@/lib/cms-public'
import { ContentIcon } from '@/lib/content-icons'
import { cn } from '@/lib/utils'

const bundledImages = propertyData.photos?.map((photo) => photo.large) ?? propertyInfo.images

export default function HomePage() {
  const { language } = useLanguage()
  const siteContent = useSiteContent()
  const ui = translations[language].ui

  // The gallery the host curates in /admin/content wins; the images bundled
  // from the original listing are the fallback for a cold or offline API.
  const galleryPhotos =
    siteContent && siteContent.images.length > 0
      ? siteContent.images
      : bundledImages.map((url) => ({ url, alt: propertyData.name }))
  const galleryImages = galleryPhotos.map((photo) => photo.url)
  // Sections and reviews come from /admin/content. When the API is unreachable
  // `sections` is empty and each block falls back to the bundled copy below.
  // True once the CMS has answered. A section missing from `sections` then
  // means the host hid it — not that the API is down — so it must not fall
  // back to the bundled copy.
  const cmsReady = siteContent?.available ?? false
  const shows = (section: { published: boolean } | undefined) =>
    cmsReady ? Boolean(section) : true
  const sections = siteContent?.sections
  const cmsReviews = siteContent?.reviews ?? []
  const featured = cmsReviews.find((review) => review.featured) ?? cmsReviews[0]
  const otherReviews = cmsReviews.filter((review) => review.id !== featured?.id).slice(0, 3)

  const features = sections?.FEATURES
  const amenities = sections?.AMENITIES
  const reviewsSection = sections?.REVIEWS
  const location = sections?.LOCATION
  const directBooking = sections?.DIRECT_BOOKING
  const host = sections?.HOST

  const featureCards = itemsOf(features, 'FEATURE_CARD')
  /**
   * The two wide photos under the cards.
   *
   * Chosen by elimination rather than by index: whatever the cards above are
   * already showing is skipped, and so is the first photo — the panel calls it
   * "la portada" and the hero opens on it. Reordering the gallery in the panel
   * never puts the same kitchen twice on the same screen.
   */
  const usedInCards = new Set(
    featureCards.map((card) => card.imageUrl).filter((url): url is string => Boolean(url)),
  )
  const stripPhotos = galleryPhotos
    .slice(1)
    .filter((photo) => !usedInCards.has(photo.url))
    .slice(0, 2)
  const amenityTags = itemsOf(amenities, 'AMENITY')
  const reviewScores = itemsOf(reviewsSection, 'REVIEW_RATING')
  const highlights = itemsOf(location, 'LOCATION_HIGHLIGHT')
  const hostStats = itemsOf(host, 'HOST_STAT')

  /** Reads a section's slot, falling back to the copy bundled in this file. */
  const text = (
    section: typeof features,
    field: 'eyebrow' | 'title' | 'subtitle' | 'body' | 'ctaLabel' | 'statLabel',
    fallback: string,
  ) => section?.[field] || fallback
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

      {shows(features) && (
        <section
          id="gallery"
          className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28"
        >
          {/* Heading on the left, the way in to the photos on the right — not a
              centred stack. The eye starts where the text starts. */}
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              {/* Only when the host has written one. The reference carries an
                  eyebrow here ("Cada detalle cuenta") and this section's is
                  empty in the panel; a phrase invented in the code would be a
                  phrase she cannot edit. */}
              {features?.eyebrow && (
                <span className="text-sm font-semibold uppercase tracking-widest text-primary">
                  {features.eyebrow}
                </span>
              )}
              <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {text(features, 'title', home.galleryTitle)}
              </h2>
            </div>

            <PhotoGallery
              photos={propertyData.photos}
              propertyName={propertyData.name}
              showAllLabel={home.showAllPhotos}
              closeLabel={ui.closeGallery}
            />
          </div>

          {featureCards.length > 0 && (
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {featureCards.map((card, index) => {
                const title = card.label
                return (
                  <article
                    key={card.id}
                    className={cn(
                      'group relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft',
                      'transition-all duration-300 hover:-translate-y-1 hover:shadow-float',
                      // The first card runs tall, which is what stops three
                      // equal boxes from reading as a form.
                      index === 0 && 'lg:row-span-2',
                    )}
                  >
                    <div
                      className={cn(
                        'relative w-full overflow-hidden bg-muted',
                        index === 0 ? 'aspect-[4/5]' : 'aspect-[16/10]',
                      )}
                    >
                      <Image
                        // A card with no image of its own borrows one from the
                        // gallery rather than leaving a hole in the grid.
                        src={card.imageUrl ?? galleryImages[index + 1] ?? galleryImages[0]}
                        alt={title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* The photo darkens towards the bottom so the icon chip
                          and the card's own edge stay readable over whatever
                          the host uploads. */}
                      <div className="absolute inset-0 bg-gradient-to-t from-ocean-deep/70 via-transparent to-transparent" />
                      <span className="glass absolute left-4 top-4 grid size-11 place-items-center rounded-2xl text-primary shadow-soft">
                        <ContentIcon name={card.icon} className="h-5 w-5" />
                      </span>
                    </div>
                    <div className="p-6">
                      <h3 className="font-display text-xl font-semibold text-foreground">
                        {title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {card.body}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {stripPhotos.length > 0 && (
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {stripPhotos.map((photo) => (
                <div
                  key={photo.url}
                  className="group relative aspect-[16/9] overflow-hidden rounded-3xl border border-border shadow-soft"
                >
                  <Image
                    src={photo.url}
                    alt={photo.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Amenities live inside this section rather than in one of their own.
          Two consecutive white cards with the same eyebrow-title-lead
          structure, both headed "Everything…", read as the page repeating
          itself — and they answer one question between them: what is here and
          what should I know. */}
      {/* The anchor the header's "Services" item and the footer both point at.
          It lived nowhere: `#amenities` was in the navigation from the start and
          no element ever claimed it, so the menu item scrolled to the top of the
          page and looked like a dead link. */}
      <div id="amenities" className="scroll-mt-24">
        <HouseDetails
          amenities={
            shows(amenities)
              ? {
                  label: text(amenities, 'eyebrow', ui.amenities),
                  tags:
                    amenityTags.length > 0
                      ? amenityTags.map((tag) => ({
                          key: tag.id,
                          icon: tag.icon,
                          label: tag.label,
                        }))
                      : propertyInfo.amenities
                          .slice(0, 18)
                          .map((amenity) => ({ key: amenity, icon: '', label: amenity })),
                }
              : undefined
          }
        />
      </div>

      {/* The whole block disappears when the host unpublishes it — an empty
          testimonials frame is worse than no testimonials. */}
      {shows(reviewsSection) && (
        <section
          id="reviews"
          className="scroll-mt-24 mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-amber-800 dark:text-amber-200">
                {text(reviewsSection, 'eyebrow', home.reviewsIntro)}
              </p>
              <h2 className="font-serif text-4xl text-foreground">
                {text(reviewsSection, 'title', home.reviewsTitle)}
              </h2>
            </div>

            {/* Measured at 1.02:1 against what is behind it, with no border and no
                shadow — a panel that exists in the markup and not on the screen.
                The rating is the thing this block is for, so it gets a surface. */}
            <div className="flex shrink-0 flex-wrap items-center gap-5 rounded-[24px] border border-border bg-card px-6 py-4 shadow-sm">
              <div className="text-center">
                <p className="font-serif text-5xl leading-none text-foreground">
                  {reviewsSection?.statValue || propertyData.rating.toFixed(1)}
                </p>
                <div className="mt-1.5 flex justify-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {text(reviewsSection, 'statLabel', `${propertyData.reviewsCount} ${ui.reviews}`)}
                </p>
              </div>

              {reviewScores.length > 0 && (
                <div className="space-y-1.5 border-l border-gray-200 pl-5">
                  {reviewScores.map((score) => {
                    // Stored out of five, drawn as a bar out of a hundred.
                    const outOfFive = Number(score.value) || 0
                    return (
                      <div key={score.id} className="flex items-center gap-2">
                        <span className="w-24 text-xs text-muted-foreground">{score.label}</span>
                        <div className="h-1 w-20 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-panel"
                            style={{ width: `${Math.min(100, (outOfFive / 5) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{score.value}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {featured && (
            <div className="relative mb-8 mt-10 overflow-hidden rounded-[32px] bg-panel p-8 md:p-10">
              <Quote className="absolute left-6 top-6 h-16 w-16 text-panel-muted" />
              <div className="relative z-10 md:flex md:items-start md:gap-8">
                <div className="flex-1">
                  <div className="mb-4 flex gap-1">
                    {Array.from({ length: featured.rating }).map((_, index) => (
                      <Star key={index} className="h-5 w-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="mb-6 whitespace-pre-line text-lg leading-relaxed text-panel-foreground md:text-xl">
                    &ldquo;{featured.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    {featured.authorPhotoUrl ? (
                      <Image
                        src={featured.authorPhotoUrl}
                        alt={featured.authorName}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full border-2 border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-card/10 text-panel-foreground">
                        <Star className="h-6 w-6 fill-current" />
                      </div>
                    )}
                    <div>
                      <p className="text-panel-foreground">- {featured.authorName}</p>
                      {featured.verified && (
                        <p className="flex items-center gap-1 text-sm text-blue-300">
                          <ShieldCheck className="h-3.5 w-3.5" /> {ui.verifiedStay}
                          {featured.stayedAt ? ` · ${featured.stayedAt}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {otherReviews.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {otherReviews.map((review) => {
                const stayedAt = review.stayedAt
                return (
                  <article
                    key={review.id}
                    className="flex flex-col gap-4 rounded-[24px] border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex gap-0.5">
                        {Array.from({ length: review.rating }).map((_, index) => (
                          <Star key={index} className="h-4 w-4 fill-amber-500 text-amber-500" />
                        ))}
                      </div>
                      {stayedAt && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {stayedAt}
                        </span>
                      )}
                    </div>
                    <p className="flex-1 whitespace-pre-line text-sm leading-relaxed text-foreground">
                      &ldquo;{review.text}&rdquo;
                    </p>
                    <div className="flex items-center gap-3 border-t border-border pt-3">
                      {review.authorPhotoUrl ? (
                        <Image
                          src={review.authorPhotoUrl}
                          alt={review.authorName}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-foreground">
                          <Users className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{review.authorName}</p>
                      </div>
                      {review.verified && (
                        <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                          <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                          {home.verified}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {shows(location) && (
        <section
          id="location"
          className="scroll-mt-24 mx-auto max-w-[1440px] px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16"
        >
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.75fr]">
            <div>
              <h2 className="font-serif text-3xl text-foreground sm:text-4xl">
                {text(location, 'title', home.locationTitle)}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {text(location, 'subtitle', home.locationSub)}
              </p>

              <div className="mt-6 overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <div className="relative h-[360px] w-full sm:h-[480px]">
                  <iframe
                    src={
                      location?.linkUrl ??
                      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3528.27419102434!2d-82.78821252441964!3d27.816251620242203!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88c2fd15ebc9ec1f%3A0xea5d3d7f3368a9aa!2sAreia%20Bela!5e0!3m2!1sen!2sus!4v1710128828956!5m2!1sen!2sus'
                    }
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
              <div className="rounded-[28px] border border-border bg-card/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <h3 className="font-serif text-2xl text-foreground">
                  {text(location, 'body', home.nearbyTitle)}
                </h3>
                <div className="mt-4 space-y-4">
                  {(highlights.length > 0
                    ? highlights.map((item) => ({
                        key: item.id,
                        icon: item.icon,
                        label: item.label,
                      }))
                    : home.nearby.map((item) => ({ key: item, icon: '', label: item }))
                  ).map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-muted px-4 py-3"
                    >
                      {item.icon ? (
                        <ContentIcon name={item.icon} className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-border bg-panel p-6 text-panel-foreground shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                <div className="flex items-center gap-2 text-panel-muted">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                    {text(directBooking, 'title', home.directTitle)}
                  </span>
                </div>
                <p className="mt-3 text-[15px] leading-7 text-panel-muted">
                  {text(directBooking, 'body', home.directBody)}
                </p>
                <Button
                  asChild
                  className="mt-5 h-11 rounded-full bg-card px-5 font-semibold text-primary hover:bg-card/90"
                >
                  <Link href={directBooking?.ctaHref || '#reservar'}>
                    {text(directBooking, 'ctaLabel', home.directCta)}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {shows(host) && (
        <section className="border-t border-border bg-background py-14 lg:py-20">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            {/* Left-aligned like the amenities and details sections, rather
                than a centred stack: this page introduces things from the left
                and the eye already knows where to start. */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-800 dark:text-amber-200">
                  {text(host, 'eyebrow', home.hostKicker)}
                </p>
                <h2 className="mt-3 font-serif text-3xl text-foreground sm:text-4xl">
                  {text(host, 'title', home.hostTitle)}
                </h2>
              </div>
              <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                {text(host, 'statLabel', ui.hostSince)}{' '}
                {host?.statValue || propertyData.hostSinceYear}
              </p>
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-[0.62fr_1fr] lg:items-stretch lg:gap-12">
              {/* The photo gets real size instead of a 256px sliver. She is
                  the content of this section; the numbers are footnotes. */}
              <div className="relative overflow-hidden rounded-[28px] bg-muted shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
                <div className="relative aspect-[4/5] w-full lg:absolute lg:inset-0 lg:aspect-auto">
                  <Image
                    src={host?.imageUrl ?? propertyData.host.pictureUrl}
                    alt={propertyData.host.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 34vw"
                    className="object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-foreground/55 to-transparent" />

                  <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center gap-2">
                    <span className="font-serif text-2xl text-panel-foreground">
                      {propertyData.host.firstName}
                    </span>
                    {text(host, 'subtitle', home.hostBadge) && (
                      <span className="flex items-center gap-1 rounded-full bg-card/90 px-3 py-1 text-xs text-foreground backdrop-blur-sm">
                        <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                        {text(host, 'subtitle', home.hostBadge)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-8 rounded-[28px] border border-border bg-card p-7 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:p-10">
                {/* Her own words, set as a quote rather than a grey paragraph.
                    It is the most human thing on the page and it was being
                    treated as filler. */}
                <blockquote className="relative">
                  <Quote
                    className="absolute -left-1 -top-2 h-10 w-10 text-primary/10"
                    aria-hidden
                  />
                  <p className="relative whitespace-pre-line font-serif text-[22px] leading-[1.55] text-foreground sm:text-[26px]">
                    {text(host, 'body', home.hostBody)}
                  </p>
                </blockquote>

                <div className="space-y-7">
                  {hostStats.length > 0 && (
                    // A row of figures with rules between them, not three
                    // tinted boxes: they are data, and boxing data gives it
                    // more weight than it has earned.
                    <dl className="flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-6">
                      {hostStats.map((stat) => (
                        <div key={stat.id}>
                          <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                            <ContentIcon name={stat.icon} className="h-3.5 w-3.5 text-primary" />
                            {stat.label}
                          </dt>
                          <dd className="mt-1 font-serif text-2xl text-foreground">{stat.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="brand" size="lg" className="w-full font-semibold sm:w-auto">
                        <Quote className="h-4 w-4" /> {text(host, 'ctaLabel', home.contactHost)}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-none bg-transparent p-0 shadow-none [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-card [&>button]:p-1.5 [&>button]:opacity-100 [&>button]:shadow-md">
                      <DialogTitle className="sr-only">
                        {text(host, 'ctaLabel', home.contactHost)}
                      </DialogTitle>
                      <ContactSection />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
