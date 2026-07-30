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
  label: string
  body?: string
  value?: string
}

interface SeedSection {
  key: ContentSectionKey
  eyebrow?: string
  title?: string
  subtitle?: string
  body?: string
  ctaLabel?: string
  ctaHref?: string
  statValue?: string
  statLabel?: string
  imageUrl?: string
  linkUrl?: string
  items: SeedItem[]
}

const photo = (index: number) => listing.photos[index]?.large ?? listing.photos[0].large

const sections: SeedSection[] = [
  {
    key: ContentSectionKey.HERO,
    title: 'Tu refugio con piscina cerca de Madeira Beach',
    subtitle: '3 dormitorios, 2 baños · Familiar · Acepta mascotas',
    body: 'A solo 5 minutos de Madeira Beach',
    ctaLabel: 'RESERVA TU ESTADÍA',
    ctaHref: '#reservar',
    items: [
      {
        kind: ContentItemKind.HERO_BADGE,
        icon: 'Users',
        label: 'Hasta 8 huéspedes',
      },
      {
        kind: ContentItemKind.HERO_BADGE,
        icon: 'Waves',
        label: 'Piscina climatizada privada',
      },
      {
        kind: ContentItemKind.HERO_BADGE,
        icon: 'PawPrint',
        label: 'Acepta mascotas',
      },
      {
        kind: ContentItemKind.HERO_BADGE,
        icon: 'Gamepad2',
        label: 'Lista para la familia',
      },
      {
        kind: ContentItemKind.HERO_BADGE,
        icon: 'Wifi',
        label: 'Wi-Fi rápido',
      },
    ],
  },
  {
    key: ContentSectionKey.FEATURES,
    title: 'Detalles pensados para una estadía inolvidable',
    items: [
      {
        kind: ContentItemKind.FEATURE_CARD,
        icon: 'Coffee',
        imageUrl: photo(1),
        label: 'Coffee Bar',
        body: 'Empieza el día con café premium, té y todo lo necesario.',
      },
      {
        kind: ContentItemKind.FEATURE_CARD,
        icon: 'Gamepad2',
        imageUrl: photo(2),
        label: 'Rincón de Juegos',
        body: 'Diversión para todas las edades con juegos de mesa, cartas y un espacio cómodo para compartir.',
      },
      {
        kind: ContentItemKind.FEATURE_CARD,
        icon: 'Umbrella',
        imageUrl: photo(3),
        label: 'Esenciales de Playa',
        body: 'Incluye sillas, toallas, sombrilla, hielera y más para tu día de playa.',
      },
    ],
  },
  {
    key: ContentSectionKey.AMENITIES,
    eyebrow: 'Servicios',
    title: 'Todo lo que necesitas, ya está aquí.',
    body: 'Detalles útiles y claros que ayudan a decidir sin ruido visual.',
    // Source amenities are Spanish-only — see the gap noted at the top.
    items: listing.amenities.slice(0, 18).map((amenity) => ({
      kind: ContentItemKind.AMENITY,
      label: amenity,
    })),
  },
  {
    key: ContentSectionKey.REVIEWS,
    eyebrow: 'Huéspedes verificados',
    title: 'Lo que dicen nuestros huéspedes',
    statValue: listing.stars.toFixed(1),
    statLabel: `${listing.reviews.reviewsCount} reseñas`,
    items: [
      {
        kind: ContentItemKind.REVIEW_RATING,
        label: 'Limpieza',
        value: '5.0',
      },
      {
        kind: ContentItemKind.REVIEW_RATING,
        label: 'Comunicación',
        value: '5.0',
      },
      {
        kind: ContentItemKind.REVIEW_RATING,
        label: 'Ubicación',
        value: '4.9',
      },
      { kind: ContentItemKind.REVIEW_RATING, label: 'Valor', value: '4.8' },
    ],
  },
  {
    key: ContentSectionKey.LOCATION,
    title: 'Dónde te quedarás',
    subtitle: 'St. Petersburg, Florida, Estados Unidos',
    body: 'Puntos cercanos',
    linkUrl:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3528.27419102434!2d-82.78821252441964!3d27.816251620242203!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88c2fd15ebc9ec1f%3A0xea5d3d7f3368a9aa!2sAreia%20Bela!5e0!3m2!1sen!2sus!4v1710128828956!5m2!1sen!2sus',
    items: [
      {
        kind: ContentItemKind.LOCATION_HIGHLIGHT,
        icon: 'MapPin',
        label: 'A 5 min de Madeira Beach',
      },
      {
        kind: ContentItemKind.LOCATION_HIGHLIGHT,
        icon: 'MapPin',
        label: "John's Pass Village & Boardwalk",
      },
      {
        kind: ContentItemKind.LOCATION_HIGHLIGHT,
        icon: 'MapPin',
        label: 'Restaurantes y cafés locales',
      },
    ],
  },
  {
    key: ContentSectionKey.DIRECT_BOOKING,
    title: 'Reserva directa',
    body: 'Reserva directo para obtener la mejor tarifa, comunicación clara y una estadía más fluida de inicio a fin.',
    ctaLabel: 'Reservar ahora',
    ctaHref: '#reservar',
    items: [],
  },
  {
    key: ContentSectionKey.HOST,
    eyebrow: 'Tu anfitriona',
    title: 'Conoce a Angélica',
    subtitle: 'Superanfitriona',
    body: '¡Hola! Soy Angélica, y me encanta compartir este hermoso rincón de Florida con viajeros de todo el mundo. Mi misión es que tu estadía sea perfecta: desde el primer mensaje hasta el último día.',
    ctaLabel: 'Contactar a Angélica',
    statValue: '2019',
    statLabel: 'Anfitriona desde',
    imageUrl: listing.primaryHost.pictureUrl,
    items: [
      {
        kind: ContentItemKind.HOST_STAT,
        icon: 'Star',
        label: 'Reseñas',
        value: `${listing.reviews.reviewsCount}+`,
      },
      {
        kind: ContentItemKind.HOST_STAT,
        icon: 'ShieldCheck',
        label: 'Respuesta',
        value: '< 1 h',
      },
      {
        kind: ContentItemKind.HOST_STAT,
        icon: 'Sparkles',
        label: 'Tasa de respuesta',
        value: listing.primaryHost.responseRateWithoutNa ?? '—',
      },
    ],
  },
  {
    key: ContentSectionKey.FOOTER,
    body: 'Escapada premium cerca de Madeira Beach con piscina climatizada, coffee bar y auto check-in para una estadía sin fricciones.',
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
        where: { sectionId: row.id, kind: item.kind, label: item.label },
      })
      if (existing) continue

      await prisma.contentItem.create({
        data: { ...item, sectionId: row.id, sortOrder: index },
      })
      itemCount += 1
    }
  }
  console.log(`Seed landing — ${sectionCount} secciones, ${itemCount} elementos nuevos`)

  // Every review the listing carries, not just the first few: they are real,
  // they are the host's, and there is no reason to leave two thirds of them out.
  // Reviews are English-only at the source: see the gap noted at the top.
  let reviewCount = 0
  for (const [index, review] of listing.reviews.reviews.entries()) {
    const text = clean(review.comments)
    const authorName = review.author?.firstName?.trim() || 'Huésped'
    const existing = await prisma.review.findFirst({ where: { authorName, text: text } })
    if (existing) continue

    await prisma.review.create({
      data: {
        authorName,
        // Deliberately not the listing's photo URL. Those live on Airbnb's CDN
        // and show four identifiable people who never agreed to appear on this
        // site — and the link is theirs to break. The site draws an initial
        // instead; the words stay exactly as the guest wrote them.
        authorPhotoUrl: null,
        rating: review.rating,
        text: text,
        stayedAt: review.localizedDate ?? '',
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
