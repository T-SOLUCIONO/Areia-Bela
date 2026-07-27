import { ContentItemKind, ContentSectionKey, PrismaClient } from '@prisma/client'
import propertyListing from '../../web/datos.json'

/**
 * Moves the landing page's own copy into the database.
 *
 * Everything here is the text that was already live in
 * `apps/web/app/[locale]/(public)/page.tsx` and `lib/i18n.ts`, plus the real
 * guest reviews and host details from the scraped listing. Nothing is invented.
 *
 * Two disclosed gaps, both with the same remedy:
 * - The amenity names in the listing exist only in Spanish, and the guest
 *   reviews only in English. Those rows are seeded with the source text on both
 *   sides.
 * - Rather than guess the missing side, the admin now has a "translate" button
 *   that proposes it for the host to review. That workflow is the answer to
 *   these gaps; filling them here with machine output nobody read would not be.
 *
 * Idempotent: sections upsert by key, items and reviews are matched by their
 * natural key before insert.
 */

const prisma = new PrismaClient()

interface Listing {
  amenities: string[]
  stars: number
  numberOfGuests: number
  reviews: {
    reviewsCount: number
    reviews: Array<{
      id: string | number
      rating: number
      comments: string
      localizedDate?: string
      author?: { firstName?: string; pictureUrl?: string }
    }>
  }
  primaryHost: {
    name: string
    firstName: string
    pictureUrl: string
    responseRateWithoutNa?: string
  }
  photos: Array<{ id: number; large: string }>
}

const listing = (propertyListing as unknown as Listing[])[0]

/** The scrape ran in Spanish, so review dates come back localized already. */
const MONTHS_ES_TO_EN: Record<string, string> = {
  enero: 'January',
  febrero: 'February',
  marzo: 'March',
  abril: 'April',
  mayo: 'May',
  junio: 'June',
  julio: 'July',
  agosto: 'August',
  septiembre: 'September',
  octubre: 'October',
  noviembre: 'November',
  diciembre: 'December',
}

function dateToEnglish(localized: string): string {
  const monthYear = /^([a-záéíóú]+) de (\d{4})$/i.exec(localized.trim())
  if (monthYear) {
    const month = MONTHS_ES_TO_EN[monthYear[1].toLowerCase()]
    if (month) return `${month} ${monthYear[2]}`
  }
  const weeks = /^Hace (\d+) semanas?$/i.exec(localized.trim())
  if (weeks) return `${weeks[1]} week${weeks[1] === '1' ? '' : 's'} ago`
  // Anything else stays as it is rather than becoming a guess.
  return localized
}

/** Strips the `<br/>` the scrape left in some review bodies. */
const clean = (text: string) => text.replace(/<br\s*\/?>/gi, '\n').trim()

interface SeedItem {
  kind: ContentItemKind
  icon?: string
  imageUrl?: string
  labelEs: string
  labelEn: string
  bodyEs?: string
  bodyEn?: string
  value?: string
}

interface SeedSection {
  key: ContentSectionKey
  eyebrowEs?: string
  eyebrowEn?: string
  titleEs?: string
  titleEn?: string
  subtitleEs?: string
  subtitleEn?: string
  bodyEs?: string
  bodyEn?: string
  ctaLabelEs?: string
  ctaLabelEn?: string
  ctaHref?: string
  statValue?: string
  statLabelEs?: string
  statLabelEn?: string
  imageUrl?: string
  linkUrl?: string
  items: SeedItem[]
}

const photo = (index: number) => listing.photos[index]?.large ?? listing.photos[0].large

const sections: SeedSection[] = [
  {
    key: ContentSectionKey.HERO,
    titleEs: 'Tu refugio con piscina cerca de Madeira Beach',
    titleEn: 'Your private pool retreat near Madeira Beach',
    subtitleEs: '3 dormitorios, 2 baños · Familiar · Acepta mascotas',
    subtitleEn: '3 bedrooms, 2 bathrooms · Family-friendly · Pet-friendly',
    bodyEs: 'A solo 5 minutos de Madeira Beach',
    bodyEn: 'Just 5 minutes to Madeira Beach',
    ctaLabelEs: 'RESERVA TU ESTADÍA',
    ctaLabelEn: 'BOOK YOUR STAY',
    ctaHref: '#reservar',
    items: [
      {
        kind: ContentItemKind.HERO_BADGE,
        icon: 'Users',
        labelEs: 'Hasta 8 huéspedes',
        labelEn: 'Sleeps 8',
      },
      {
        kind: ContentItemKind.HERO_BADGE,
        icon: 'Waves',
        labelEs: 'Piscina climatizada privada',
        labelEn: 'Private Heated Pool',
      },
      {
        kind: ContentItemKind.HERO_BADGE,
        icon: 'PawPrint',
        labelEs: 'Acepta mascotas',
        labelEn: 'Pet Friendly',
      },
      {
        kind: ContentItemKind.HERO_BADGE,
        icon: 'Gamepad2',
        labelEs: 'Lista para la familia',
        labelEn: 'Family Ready',
      },
      {
        kind: ContentItemKind.HERO_BADGE,
        icon: 'Wifi',
        labelEs: 'Wi-Fi rápido',
        labelEn: 'Fast Wi-Fi',
      },
    ],
  },
  {
    key: ContentSectionKey.FEATURES,
    titleEs: 'Detalles pensados para una estadía inolvidable',
    titleEn: 'Thoughtful touches for an unforgettable stay',
    items: [
      {
        kind: ContentItemKind.FEATURE_CARD,
        icon: 'Coffee',
        imageUrl: photo(1),
        labelEs: 'Coffee Bar',
        labelEn: 'Coffee Bar',
        bodyEs: 'Empieza el día con café premium, té y todo lo necesario.',
        bodyEn: 'Start your day the beach way. Enjoy premium coffee, tea, and all the essentials.',
      },
      {
        kind: ContentItemKind.FEATURE_CARD,
        icon: 'Gamepad2',
        imageUrl: photo(2),
        labelEs: 'Rincón de Juegos',
        labelEn: 'Family Game Corner',
        bodyEs:
          'Diversión para todas las edades con juegos de mesa, cartas y un espacio cómodo para compartir.',
        bodyEn: 'Fun for all ages with board games, cards, and a cozy spot to connect and play.',
      },
      {
        kind: ContentItemKind.FEATURE_CARD,
        icon: 'Umbrella',
        imageUrl: photo(3),
        labelEs: 'Esenciales de Playa',
        labelEn: 'Beach Essentials',
        bodyEs: 'Incluye sillas, toallas, sombrilla, hielera y más para tu día de playa.',
        bodyEn: "We've got you covered with beach chairs, towels, umbrella, cooler and more.",
      },
    ],
  },
  {
    key: ContentSectionKey.AMENITIES,
    eyebrowEs: 'Servicios',
    eyebrowEn: 'Amenities',
    titleEs: 'Todo lo que necesitas, ya está aquí.',
    titleEn: 'Everything you need, already in place.',
    bodyEs: 'Detalles útiles y claros que ayudan a decidir sin ruido visual.',
    bodyEn:
      'Clean, useful details that help guests decide faster without scanning a noisy block of icons.',
    // Source amenities are Spanish-only — see the gap noted at the top.
    items: listing.amenities.slice(0, 18).map((amenity) => ({
      kind: ContentItemKind.AMENITY,
      labelEs: amenity,
      labelEn: amenity,
    })),
  },
  {
    key: ContentSectionKey.REVIEWS,
    eyebrowEs: 'Huéspedes verificados',
    eyebrowEn: 'Verified guests',
    titleEs: 'Lo que dicen nuestros huéspedes',
    titleEn: 'What our guests say',
    statValue: listing.stars.toFixed(1),
    statLabelEs: `${listing.reviews.reviewsCount} reseñas`,
    statLabelEn: `${listing.reviews.reviewsCount} reviews`,
    items: [
      {
        kind: ContentItemKind.REVIEW_RATING,
        labelEs: 'Limpieza',
        labelEn: 'Cleanliness',
        value: '5.0',
      },
      {
        kind: ContentItemKind.REVIEW_RATING,
        labelEs: 'Comunicación',
        labelEn: 'Communication',
        value: '5.0',
      },
      {
        kind: ContentItemKind.REVIEW_RATING,
        labelEs: 'Ubicación',
        labelEn: 'Location',
        value: '4.9',
      },
      { kind: ContentItemKind.REVIEW_RATING, labelEs: 'Valor', labelEn: 'Value', value: '4.8' },
    ],
  },
  {
    key: ContentSectionKey.LOCATION,
    titleEs: 'Dónde te quedarás',
    titleEn: "Where you'll be staying",
    subtitleEs: 'St. Petersburg, Florida, Estados Unidos',
    subtitleEn: 'St. Petersburg, Florida, United States',
    bodyEs: 'Puntos cercanos',
    bodyEn: 'Highlights nearby',
    linkUrl:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3528.27419102434!2d-82.78821252441964!3d27.816251620242203!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88c2fd15ebc9ec1f%3A0xea5d3d7f3368a9aa!2sAreia%20Bela!5e0!3m2!1sen!2sus!4v1710128828956!5m2!1sen!2sus',
    items: [
      {
        kind: ContentItemKind.LOCATION_HIGHLIGHT,
        icon: 'MapPin',
        labelEs: 'A 5 min de Madeira Beach',
        labelEn: '5 min from Madeira Beach',
      },
      {
        kind: ContentItemKind.LOCATION_HIGHLIGHT,
        icon: 'MapPin',
        labelEs: "John's Pass Village & Boardwalk",
        labelEn: "John's Pass Village & Boardwalk",
      },
      {
        kind: ContentItemKind.LOCATION_HIGHLIGHT,
        icon: 'MapPin',
        labelEs: 'Restaurantes y cafés locales',
        labelEn: 'Local restaurants and cafés',
      },
    ],
  },
  {
    key: ContentSectionKey.DIRECT_BOOKING,
    titleEs: 'Reserva directa',
    titleEn: 'Direct booking',
    bodyEs:
      'Reserva directo para obtener la mejor tarifa, comunicación clara y una estadía más fluida de inicio a fin.',
    bodyEn:
      'Book direct for the best rate, clear communication, and a smoother stay from start to finish.',
    ctaLabelEs: 'Reservar ahora',
    ctaLabelEn: 'Book now',
    ctaHref: '#reservar',
    items: [],
  },
  {
    key: ContentSectionKey.HOST,
    eyebrowEs: 'Tu anfitriona',
    eyebrowEn: 'Your host',
    titleEs: 'Conoce a Angélica',
    titleEn: 'Meet Angélica',
    subtitleEs: 'Superanfitriona',
    subtitleEn: 'Superhost',
    bodyEs:
      '¡Hola! Soy Angélica, y me encanta compartir este hermoso rincón de Florida con viajeros de todo el mundo. Mi misión es que tu estadía sea perfecta: desde el primer mensaje hasta el último día.',
    bodyEn:
      'Hi! I am Angélica, and I love sharing this beautiful corner of Florida with travelers from around the world. My mission is to make your stay perfect: from the first message to your last day.',
    ctaLabelEs: 'Contactar a Angélica',
    ctaLabelEn: 'Contact Angélica',
    statValue: '2019',
    statLabelEs: 'Anfitriona desde',
    statLabelEn: 'Host since',
    imageUrl: listing.primaryHost.pictureUrl,
    items: [
      {
        kind: ContentItemKind.HOST_STAT,
        icon: 'Star',
        labelEs: 'Reseñas',
        labelEn: 'Reviews',
        value: `${listing.reviews.reviewsCount}+`,
      },
      {
        kind: ContentItemKind.HOST_STAT,
        icon: 'ShieldCheck',
        labelEs: 'Respuesta',
        labelEn: 'Response',
        value: '< 1 h',
      },
      {
        kind: ContentItemKind.HOST_STAT,
        icon: 'Sparkles',
        labelEs: 'Tasa de respuesta',
        labelEn: 'Response rate',
        value: listing.primaryHost.responseRateWithoutNa ?? '—',
      },
    ],
  },
  {
    key: ContentSectionKey.FOOTER,
    bodyEs:
      'Escapada premium cerca de Madeira Beach con piscina climatizada, coffee bar y auto check-in para una estadía sin fricciones.',
    bodyEn:
      'Premium getaway near Madeira Beach with a heated pool, coffee bar, and self check-in for a smooth stay.',
    items: [],
  },
]

async function main() {
  let sectionCount = 0
  let itemCount = 0

  for (const { items, ...section } of sections) {
    const row = await prisma.contentSection.upsert({
      where: { key: section.key },
      update: {},
      create: section,
    })
    sectionCount += 1

    for (const [index, item] of items.entries()) {
      // Natural key: one label per list per section. Re-running must not
      // duplicate, and must not overwrite an edit the host already made.
      const existing = await prisma.contentItem.findFirst({
        where: { sectionId: row.id, kind: item.kind, labelEn: item.labelEn },
      })
      if (existing) continue

      await prisma.contentItem.create({
        data: { ...item, sectionId: row.id, sortOrder: index },
      })
      itemCount += 1
    }
  }
  console.log(`Seed landing — ${sectionCount} secciones, ${itemCount} elementos nuevos`)

  // The four reviews the page already showed, straight from the listing.
  // Reviews are English-only at the source: see the gap noted at the top.
  let reviewCount = 0
  for (const [index, review] of listing.reviews.reviews.slice(0, 4).entries()) {
    const text = clean(review.comments)
    const authorName = review.author?.firstName?.trim() || 'Huésped'
    const existing = await prisma.review.findFirst({ where: { authorName, textEn: text } })
    if (existing) continue

    await prisma.review.create({
      data: {
        authorName,
        authorPhotoUrl: review.author?.pictureUrl ?? null,
        rating: review.rating,
        textEs: text,
        textEn: text,
        stayedAtEs: review.localizedDate ?? '',
        stayedAtEn: review.localizedDate ? dateToEnglish(review.localizedDate) : '',
        verified: true,
        featured: index === 0,
        sortOrder: index,
      },
    })
    reviewCount += 1
  }
  console.log(`Seed landing — ${reviewCount} reseñas nuevas`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
