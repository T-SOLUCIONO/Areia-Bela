import type { Metadata } from 'next'
import { Amenities, type Faq } from '@/components/areia/amenities'
import { CtaFooter } from '@/components/areia/cta-footer'
import { Gallery } from '@/components/areia/gallery'
import { Hero } from '@/components/areia/hero'
import { Host } from '@/components/areia/host'
import { Location } from '@/components/areia/location'
import { Reviews, type Review } from '@/components/areia/reviews'
import { SiteHeader } from '@/components/areia/site-header'
import { API_URL } from '@/lib/api-client'

/**
 * The alternate landing, rebuilt from the reference project's own source.
 *
 * Lives outside `[locale]/(public)` on purpose: that layout brings the current
 * header, footer and assistant, which would fight this design and make a
 * side-by-side comparison meaningless. The root layout supplies the fonts and the
 * theme, and nothing else.
 *
 * ## What differs from the reference, and why
 *
 * - **Photos and questions come from the CMS**, not from `/images/*.png`. The host
 *   changes the hero by reordering photos in the panel rather than asking for a
 *   deploy, and a question edited at four in the afternoon is live at four.
 * - **The nightly rate comes from the API.** A price typed into a component is a
 *   number that goes stale in silence, and in this project the server owns pricing.
 * - **Dark mode exists.** The reference is light-only — `color-scheme: light` and a
 *   hardcoded `light` class — so the glass and shadow utilities here are built from
 *   tokens instead of literal white, or a dark page would carry a bright slab
 *   through its middle.
 * - **Spanish only.** The point is to agree on a design; wiring five locales into a
 *   page that may be discarded is effort spent on the wrong question.
 */

export const metadata: Metadata = {
  // Its own title so nobody mistakes this for the live site in a tab strip.
  title: 'Areia Bela · propuesta de diseño',
  robots: { index: false, follow: false },
}

interface Site {
  images: { url: string; alt: string }[]
  faqs: Faq[]
  reviews: Review[]
  settings: { whatsapp: string } | null
}

interface Property {
  maxGuests: number
  bedrooms: number
  bathrooms: number
  city: string
  country: string
  pricePerNight?: number
}

async function load<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { next: { revalidate: 300 } })
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    // A design preview that 500s because the API is asleep is worse than one that
    // renders with the pieces it has.
    return null
  }
}

export default async function PreviewPage() {
  const [site, property] = await Promise.all([
    load<Site>('/cms/site?locale=es'),
    load<Property>('/properties/areia-bela'),
  ])

  const photos = site?.images ?? []
  // The panel calls the first photo "la portada", so the hero follows it and the
  // rest queue up behind — the cover is never shown twice.
  const [cover, ...rest] = photos
  const rate = property?.pricePerNight ?? 300
  const city = property?.city ?? 'St. Petersburg'

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <Hero
        photo={cover}
        rate={rate}
        maxGuests={property?.maxGuests ?? 8}
        bedrooms={property?.bedrooms ?? 3}
        bathrooms={property?.bathrooms ?? 2}
      />
      <Gallery photos={rest} />
      <Amenities faqs={site?.faqs ?? []} />
      <Reviews reviews={site?.reviews ?? []} />
      <Location
        photo={rest[5] ?? cover}
        city={city}
        country={property?.country ?? 'Estados Unidos'}
      />
      <Host
        photo={rest[6] ?? rest[0]}
        reviewCount={site?.reviews.length ?? 0}
        whatsapp={site?.settings?.whatsapp ?? null}
      />
      <CtaFooter photo={cover} rate={rate} city={city} />
    </main>
  )
}
