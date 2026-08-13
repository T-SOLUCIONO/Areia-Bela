'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Award,
  BadgeCheck,
  ChevronRight,
  MapPin,
  MessageCircle,
  Quote,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@areia-bela/ui/dialog'
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
  /**
   * Four quotes, the one the host starred first.
   *
   * The featured review used to get a navy panel of its own above the others.
   * The panel is gone — the reference gives every quote the same card — but the
   * host's choice is not: it still leads.
   */
  const featured = cmsReviews.find((review) => review.featured)
  const shownReviews = [
    ...(featured ? [featured] : []),
    ...cmsReviews.filter((review) => review.id !== featured?.id),
  ].slice(0, 4)

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
            { icon: 'Waves', label: '5 min from Madeira Beach', body: 'White sand and Gulf water' },
            {
              icon: 'Ship',
              label: "John's Pass Village & Boardwalk",
              body: 'Boardwalk, shops and seafood',
            },
            {
              icon: 'Coffee',
              label: 'Local restaurants and cafés',
              body: 'A bike ride or a walk away',
            },
          ],
          directTitle: 'Direct booking',
          directHeadline: 'Book direct and save on your beach getaway',
          directBody:
            'Clear communication, the best rate, and a smoother stay from start to finish.',
          directFrom: 'From ${price} per night.',
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
            {
              icon: 'Waves',
              label: 'A 5 min de Madeira Beach',
              body: 'Arena blanca y aguas del Golfo',
            },
            {
              icon: 'Ship',
              label: "John's Pass Village & Boardwalk",
              body: 'Paseo marítimo, tiendas y mariscos',
            },
            {
              icon: 'Coffee',
              label: 'Restaurantes y cafés locales',
              body: 'A distancia de bici o caminando',
            },
          ],
          directTitle: 'Reserva directa',
          directHeadline: 'Reserva directo y ahorra en tu escapada a la playa',
          directBody:
            'Comunicación clara, la mejor tarifa y una estadía más fluida de inicio a fin.',
          directFrom: 'Desde ${price} por noche.',
          directCta: 'Reservar ahora',
          hostKicker: 'Tu anfitriona',
          hostTitle: 'Conoce a Angélica',
          hostBadge: 'Superanfitriona',
          hostBody:
            '¡Hola! Soy Angélica, y me encanta compartir este hermoso rincón de Florida con viajeros de todo el mundo. Mi misión es que tu estadía sea perfecta: desde el primer mensaje hasta el último día.',
          contactHost: 'Contactar a Angélica',
          verified: 'Verificado',
        }

  /**
   * The three points near the house, and the icon and line under each.
   *
   * The panel holds the three labels but leaves the descriptions empty and gives
   * all three the generic pin, so the list rendered as the same marker three
   * times with nothing under it. What the panel does say wins; where it says
   * nothing, the bundled entry at the same position fills in. The moment the
   * host picks an icon of her own or writes a line, hers is what shows.
   */
  const nearbyPoints =
    highlights.length > 0
      ? highlights.map((item, index) => {
          const fallback = home.nearby[index]
          return {
            key: item.id,
            icon: item.icon && item.icon !== 'MapPin' ? item.icon : (fallback?.icon ?? 'MapPin'),
            label: item.label,
            body: item.body || (fallback?.body ?? ''),
          }
        })
      : home.nearby.map((item) => ({ key: item.label, ...item }))
  /**
   * The address, split for the two lines the pill wants. The panel stores one
   * string — "St. Petersburg, Florida, Estados Unidos" — and the last comma is
   * where the country starts.
   */
  const address = text(location, 'subtitle', home.locationSub)
  const lastComma = address.lastIndexOf(',')
  const place =
    lastComma > 0
      ? { where: address.slice(0, lastComma).trim(), country: address.slice(lastComma + 1).trim() }
      : { where: address, country: '' }
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
                      'group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft',
                      'transition-all duration-300 hover:-translate-y-1 hover:shadow-float',
                    )}
                  >
                    {/* All three the same, at the tall card's proportion. The
                        staggered version put one card at 4/5 and two at 16/10,
                        which left a hole under the short pair and made the row
                        look unfinished when the texts were of different
                        lengths. */}
                    <div className="relative w-full overflow-hidden bg-muted aspect-[4/5]">
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
          className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28"
        >
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
                <BadgeCheck className="h-4 w-4" aria-hidden />
                {text(reviewsSection, 'eyebrow', home.reviewsIntro)}
              </span>
              <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {text(reviewsSection, 'title', home.reviewsTitle)}
              </h2>

              <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-end gap-3">
                  <span className="font-display text-5xl font-semibold leading-none text-foreground">
                    {reviewsSection?.statValue || propertyData.rating.toFixed(1)}
                  </span>
                  <div className="mb-1">
                    <div className="flex gap-0.5 text-accent">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className="h-4 w-4 fill-current" aria-hidden />
                      ))}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {text(
                        reviewsSection,
                        'statLabel',
                        `${propertyData.reviewsCount} ${ui.reviews}`,
                      )}
                    </p>
                  </div>
                </div>

                {reviewScores.length > 0 && (
                  <div className="mt-6 space-y-3">
                    {reviewScores.map((score) => {
                      // Stored out of five, drawn as a bar out of a hundred.
                      const outOfFive = Number(score.value) || 0
                      return (
                        <div key={score.id} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 text-sm text-muted-foreground">
                            {score.label}
                          </span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-ocean to-primary"
                              style={{ width: `${Math.min(100, (outOfFive / 5) * 100)}%` }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right text-sm font-semibold text-foreground">
                            {score.value}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {shownReviews.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2">
                {shownReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    verifiedLabel={ui.verifiedStay}
                    readLabel={ui.readReview}
                    closeLabel={ui.closeGallery}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {shows(location) && (
        <section
          id="location"
          className="relative scroll-mt-24 overflow-hidden bg-secondary/60 py-20 lg:py-28"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              {/* The reference puts a photograph here. This is the real map —
                  it answers the same question and answers it better, and the
                  glass pill from the reference sits on it just the same. */}
              <div className="relative overflow-hidden rounded-3xl border border-border shadow-float">
                <div className="relative aspect-[4/3] w-full">
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
                {/* Under the map, not floating on it. The reference's pill sits
                    on a photograph, where it covers nothing that matters; on a
                    live map every corner is taken — Google's place card at the
                    top left, its controls and its required attribution along the
                    bottom. So it becomes the frame's own footer. */}
                <div className="flex items-center gap-3 border-t border-border bg-card px-4 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                    <MapPin className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{place.where}</p>
                    {place.country && (
                      <p className="text-xs text-muted-foreground">{place.country}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                {location?.eyebrow && (
                  <span className="text-sm font-semibold uppercase tracking-widest text-primary">
                    {location.eyebrow}
                  </span>
                )}
                <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  {text(location, 'title', home.locationTitle)}
                </h2>

                <h3 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  {text(location, 'body', home.nearbyTitle)}
                </h3>
                <ul className="mt-4 space-y-3">
                  {nearbyPoints.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5"
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <ContentIcon name={item.icon} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        {item.body && <p className="text-xs text-muted-foreground">{item.body}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {shows(host) && (
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-float">
            <div className="grid md:grid-cols-[0.8fr_1.2fr]">
              {/* Full-bleed against the card's edge, not a rounded portrait
                  floating inside it. She is the content of this section. */}
              <div className="relative min-h-72 bg-muted md:min-h-full">
                <Image
                  src={host?.imageUrl ?? propertyData.host.pictureUrl}
                  alt={propertyData.host.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>

              <div className="p-8 sm:p-10 lg:p-12">
                <span className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-sand-foreground">
                  <Award className="h-3.5 w-3.5" aria-hidden />
                  {text(host, 'subtitle', home.hostBadge)}
                  {host?.statValue
                    ? ` · ${text(host, 'statLabel', ui.hostSince)} ${host.statValue}`
                    : ''}
                </span>
                <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {text(host, 'title', home.hostTitle)}
                </h2>
                <p className="mt-4 whitespace-pre-line text-pretty leading-relaxed text-muted-foreground">
                  {text(host, 'body', home.hostBody)}
                </p>

                {hostStats.length > 0 && (
                  <dl className="mt-8 grid grid-cols-3 gap-3">
                    {hostStats.map((stat) => (
                      <div
                        key={stat.id}
                        className="rounded-2xl border border-border bg-background/60 p-4 text-center"
                      >
                        <ContentIcon name={stat.icon} className="mx-auto h-5 w-5 text-primary" />
                        <dd className="mt-2 font-display text-xl font-semibold text-foreground">
                          {stat.value}
                        </dd>
                        <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                      </div>
                    ))}
                  </dl>
                )}

                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary hover:text-primary"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      {text(host, 'ctaLabel', home.contactHost)}
                    </button>
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
        </section>
      )}

      {/* The closing panel: the last thing on the page is the reason the guest
          came. Navy in both themes, like every dark panel in this design, so it
          reads as the end of the page whatever the theme is doing. */}
      {shows(directBooking) && (
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-ocean-deep p-8 shadow-float sm:p-12 lg:p-16">
            {galleryImages[0] && (
              <div className="absolute inset-0 opacity-30">
                <Image
                  src={galleryImages[0]}
                  alt=""
                  aria-hidden
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-ocean-deep via-ocean-deep/90 to-ocean-deep/60" />

            {/* `text-white` rather than `text-foreground`: this panel is navy in
                both themes, so a token that flips would take the text with it. */}
            <div className="relative z-10 max-w-xl text-white">
              <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium">
                <Star className="h-3.5 w-3.5 fill-current text-accent" aria-hidden />
                {/* The section's name and the promise, the way the reference
                    reads it: "Reserva directa · Mejor tarifa garantizada". The
                    guarantee is already translated in all five locales. */}
                {text(directBooking, 'title', home.directTitle)} ·{' '}
                {translations[language].availability.guaranteed}
              </span>
              {/* The headline sits in the section's `subtitle`, which is empty in
                  /admin/content — so what shows is the reference's own line,
                  and the host can replace it from the panel whenever she wants. */}
              <h2 className="mt-5 text-balance font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                {text(directBooking, 'subtitle', home.directHeadline)}
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-white/90">
                {text(directBooking, 'body', home.directBody)}{' '}
                {home.directFrom.replace('{price}', String(propertyData.pricing.price_per_night))}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href={directBooking?.ctaHref || '#reservar'}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-float transition-all hover:-translate-y-0.5"
                >
                  {text(directBooking, 'ctaLabel', home.directCta)}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
                <span className="inline-flex items-center gap-2 text-sm text-white/90">
                  <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
                  {translations[language].availability.noChargeYet}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * One quote, and the whole quote behind a click.
 *
 * Guests write however long they like: one review here runs eleven lines and
 * the next runs two, which left the grid with a tall card beside an almost
 * empty one. The card clamps to six lines so the four read as a set, and the
 * card itself is the button that opens the rest — clamping text without a way
 * to reach what was cut is just hiding it.
 */
function ReviewCard({
  review,
  verifiedLabel,
  readLabel,
  closeLabel,
}: {
  review: {
    id: string
    text: string
    authorName: string
    authorPhotoUrl?: string | null
    stayedAt?: string | null
    verified?: boolean
  }
  verifiedLabel: string
  readLabel: string
  closeLabel: string
}) {
  const meta = [review.verified ? verifiedLabel : null, review.stayedAt].filter(Boolean).join(' · ')
  /**
   * Whether the clamp actually cut anything.
   *
   * Measured rather than guessed from a character count: the clamp is six
   * lines, and how many characters fit in six lines depends on the column, the
   * language and where the guest pressed Enter. A "read the full review" under
   * a review that is already complete is a promise of something more.
   */
  const textRef = useRef<HTMLParagraphElement>(null)
  const [clamped, setClamped] = useState(false)
  useEffect(() => {
    const element = textRef.current
    if (element) setClamped(element.scrollHeight > element.clientHeight + 1)
  }, [review.text])

  /* Her photo when there is one, her initial when there is not — an empty
     circle says nothing about who wrote this. */
  const author = (
    <>
      {review.authorPhotoUrl ? (
        <Image
          src={review.authorPhotoUrl}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary"
        >
          {review.authorName.charAt(0)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{review.authorName}</p>
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      </div>
    </>
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        {/* The card is the control, not a link buried inside it: a quote you
            can only half read is asking to be tapped anywhere. */}
        <button
          type="button"
          aria-label={`${readLabel}: ${review.authorName}`}
          className="flex flex-col rounded-3xl border border-border bg-card p-6 text-left shadow-soft transition-all hover:-translate-y-1 hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Quote className="h-7 w-7 text-primary/25" fill="currentColor" aria-hidden />
          <p
            ref={textRef}
            className="mt-3 line-clamp-6 flex-1 whitespace-pre-line text-sm leading-relaxed text-foreground"
          >
            {review.text}
          </p>
          {/* Ink with a teal rule under it, not teal type. `--primary` is the
              reference's exact turquoise and it measures 4.37:1 on a white card
              — fine for a decorative eyebrow, not for the one line that tells
              you there is more to read. The colour stays, as the underline. */}
          {clamped && (
            <span className="mt-3 text-sm font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4">
              {readLabel}
            </span>
          )}
          <span className="mt-5 flex items-center gap-3 border-t border-border pt-4">{author}</span>
        </button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="max-h-[85vh] max-w-lg overflow-y-auto rounded-3xl border-border bg-card p-6 sm:p-8"
      >
        <DialogTitle className="sr-only">{`${readLabel}: ${review.authorName}`}</DialogTitle>
        <DialogClose asChild>
          <button
            type="button"
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-secondary text-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">{closeLabel}</span>
          </button>
        </DialogClose>

        <Quote className="h-8 w-8 text-primary/25" fill="currentColor" aria-hidden />
        <blockquote className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
          {review.text}
        </blockquote>
        <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4">
          {author}
        </figcaption>
      </DialogContent>
    </Dialog>
  )
}
