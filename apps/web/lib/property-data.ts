import data from '@/datos.json'

type RawReview = {
  id: string
  rating: number
  comments: string
  localizedDate?: string
  author?: { firstName?: string; pictureUrl?: string }
}

type RawListing = {
  name: string
  city: string
  address: string
  country: string
  numberOfGuests: number
  stars: number
  amenities: string[]
  photos: Array<{ id: number; large: string; caption?: string }>
  reviews: { reviews: RawReview[]; reviewsCount: number }
  location: { lat: number; lng: number }
  sectionedDescription: { summary: string; description: string }
  primaryHost: {
    name: string
    firstName: string
    about: string
    pictureUrl: string
    languages: string[]
    isSuperhost: boolean
    responseRateWithoutNa?: string
    responseTimeWithoutNa?: string
    memberSinceFullStr?: string
  }
  bedroomLabel: string
  bedLabel: string
  bathroomLabel: string
  pricing: {
    price_per_night: number
    cleaning_fee: number
    service_fee_percent: number
    taxes_percent: number
    extras: Array<{ id: string; label: string; price_per_night: number }>
  }
}

// Matches the Property.slug seeded in apps/api/prisma/seed.ts
export const PROPERTY_SLUG = 'areia-bela'

// These scraped Airbnb CDN photo IDs no longer resolve (404) — confirmed by
// direct request. Filtered out so the hero/gallery never render a blank slot.
const BROKEN_PHOTO_IDS = new Set([2484516739, 2474972136, 2474972137])

const listing = (data as RawListing[])[0]
const hostSinceYearMatch = listing.primaryHost.memberSinceFullStr?.match(/(\d{4})/)
const hostSinceYear = hostSinceYearMatch ? Number(hostSinceYearMatch[1]) : 2019

export type ResponseTimeKey = 'within-an-hour' | 'within-a-few-hours' | 'within-a-day' | 'unknown'

/**
 * The scraped host fields are locale-locked Spanish sentences (e.g. "en menos
 * de una hora"), so they can't be concatenated after a translated prefix.
 * Collapsing them to a key lets each language render a whole, correct phrase.
 */
function normalizeResponseTime(raw?: string): ResponseTimeKey {
  if (!raw) return 'unknown'
  const value = raw.toLowerCase()
  const mentionsHour = value.includes('hora') || value.includes('hour')
  if (mentionsHour && (value.includes('menos') || value.includes('an hour')))
    return 'within-an-hour'
  if (mentionsHour) return 'within-a-few-hours'
  if (value.includes('día') || value.includes('dia') || value.includes('day')) return 'within-a-day'
  return 'unknown'
}
const originalPricePerNight = Math.round(listing.pricing.price_per_night * 1.15)

export const propertyData = {
  id: '1489399156507737323',
  name: listing.name,
  city: listing.city,
  address: listing.address,
  country: listing.country,
  capacity: listing.numberOfGuests,
  rating: listing.stars,
  summary: listing.sectionedDescription.summary,
  description: listing.sectionedDescription.description,
  amenities: listing.amenities,
  photos: listing.photos.filter((photo) => !BROKEN_PHOTO_IDS.has(photo.id)),
  location: listing.location,
  host: {
    ...listing.primaryHost,
    // The scrape dropped the accent; the site's own copy uses "Angélica".
    name: listing.primaryHost.name.replace(/^Angelica$/, 'Angélica'),
    firstName: listing.primaryHost.firstName.replace(/^Angelica$/, 'Angélica'),
  },
  hostSinceYear,
  hostResponseTime: normalizeResponseTime(listing.primaryHost.responseTimeWithoutNa),
  bedroomLabel: listing.bedroomLabel,
  bedLabel: listing.bedLabel,
  bathroomLabel: listing.bathroomLabel,
  pricing: {
    ...listing.pricing,
    original_price_per_night: originalPricePerNight,
  },
  reviewsCount: listing.reviews.reviewsCount,
  reviews: listing.reviews.reviews,
}
