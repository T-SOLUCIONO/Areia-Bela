import { SITE_URL } from '@/lib/site-url'

interface Props {
  locale: string
  name: string
  description: string
  address: { street: string; city: string; state: string; country: string; postalCode?: string }
  maxGuests: number
  bedrooms: number
  bathrooms: number
  checkInTime: string
  checkOutTime: string
  /** The lowest nightly rate on offer, for the price range. */
  fromPerNight?: number
  images: string[]
}

/**
 * What the house is, in the vocabulary a search engine reads.
 *
 * Everything here is already on the page in prose; this says the same thing in
 * a form that can be parsed, which is what puts a rental in the panel a search
 * result shows rather than in a blue link.
 *
 * Only facts that exist in the database. No rating, no review count, no
 * availability: inventing those is how a listing gets a manual penalty, and
 * this house has no aggregate rating to declare.
 */
export function StructuredData({
  locale,
  name,
  description,
  address,
  maxGuests,
  bedrooms,
  bathrooms,
  checkInTime,
  checkOutTime,
  fromPerNight,
  images,
}: Props) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'VacationRental',
    '@id': `${SITE_URL}/${locale}#house`,
    name,
    description,
    url: `${SITE_URL}/${locale}`,
    inLanguage: locale,
    image: images.map((src) => (src.startsWith('http') ? src : `${SITE_URL}${src}`)),
    address: {
      '@type': 'PostalAddress',
      streetAddress: address.street,
      addressLocality: address.city,
      addressRegion: address.state,
      addressCountry: address.country,
      ...(address.postalCode ? { postalCode: address.postalCode } : {}),
    },
    // The whole house is one unit. `numberOfRooms` on a rental means rooms a
    // guest gets, and they get all of them.
    containsPlace: {
      '@type': 'Accommodation',
      '@id': `${SITE_URL}/${locale}#accommodation`,
      numberOfBedrooms: bedrooms,
      numberOfBathroomsTotal: bathrooms,
      occupancy: { '@type': 'QuantitativeValue', maxValue: maxGuests },
    },
    checkinTime: checkInTime,
    checkoutTime: checkOutTime,
    // Only when there is a real rate. An invented "from" price is the kind of
    // thing a guest notices at checkout.
    ...(fromPerNight
      ? { priceRange: `From $${fromPerNight} per night`, currenciesAccepted: 'USD' }
      : {}),
  }

  return (
    <script
      type="application/ld+json"
      // The object is built here from typed fields, never from anything a
      // visitor sent. `<` is escaped so a stray one cannot close the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
