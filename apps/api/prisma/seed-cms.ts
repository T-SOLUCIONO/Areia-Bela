import { CMSPageSlug, FAQCategory, PrismaClient } from '@prisma/client'
import propertyListing from '../../web/datos.json'

/**
 * Seeds the CMS with the property's real copy, per CLAUDE.md's "real data, no
 * fixtures" rule.
 *
 * Disclosed gap: the scraped listing only exists in English. Spanish columns
 * are seeded with that same English text and flagged in the admin as awaiting
 * translation — inventing Spanish marketing copy would be worse than showing
 * the host exactly what still needs their words. Translating it is what the
 * editor built in this phase is for.
 *
 * Only the pages that have real source text are created. The remaining slugs
 * are left absent; the update endpoint upserts them on first save.
 */

const prisma = new PrismaClient()

interface RawDescription {
  space?: string
  neighborhoodOverview?: string
  houseRules?: string
  notes?: string
  transit?: string
}

async function main() {
  const listing = (
    propertyListing as Array<{
      sectionedDescription: RawDescription
      photos: Array<{ id: number; large: string; caption?: string }>
    }>
  )[0]
  const source = listing.sectionedDescription

  const pages: Array<{ slug: CMSPageSlug; title: string; body?: string }> = [
    {
      slug: CMSPageSlug.ABOUT_SPACE,
      title: 'Sobre la casa',
      body: source.space,
    },
    {
      slug: CMSPageSlug.LOCATION,
      title: 'Dónde está',
      body: [source.neighborhoodOverview, source.transit].filter(Boolean).join('\n\n'),
    },
    {
      slug: CMSPageSlug.HOUSE_RULES,
      title: 'Normas de la casa',
      body: source.houseRules,
    },
    {
      slug: CMSPageSlug.GUEST_ACCESS,
      title: 'Antes de reservar',
      body: source.notes,
    },
  ]

  let created = 0
  for (const page of pages) {
    const body = page.body?.trim()
    if (!body) continue

    await prisma.cMSPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: {
        slug: page.slug,
        title: page.title,
        // Same text both sides: see the note above on the translation gap.
        body: body,
      },
    })
    created += 1
  }
  console.log(`Seed CMS — ${created} páginas con texto real del listing`)

  // These four come from docs/domain-decisions.md, which documents them in
  // Spanish, so both languages here are genuine rather than duplicated.
  const faqs = [
    {
      question: '¿Puedo llevar a mi mascota?',
      answer: 'Sí, se admiten perros y gatos. Hay un cargo de $100 por estadía, no reembolsable.',
      category: FAQCategory.PETS,
      sortOrder: 0,
    },
    {
      question: '¿La piscina está climatizada?',
      answer:
        'La calefacción es opcional, cuesta $20 por noche y está disponible del 1 de octubre al 1 de mayo.',
      category: FAQCategory.POOL,
      sortOrder: 1,
    },
    {
      question: '¿Qué días pasa el camión de la basura?',
      answer: 'Miércoles y sábado. Deja los contenedores en la acera la noche anterior.',
      category: FAQCategory.TRASH,
      sortOrder: 2,
    },
    {
      question: '¿Se pueden hacer fiestas?',
      answer:
        'No. No se permiten eventos ni reuniones numerosas: queremos mantener el vecindario tranquilo.',
      category: FAQCategory.PARTIES,
      sortOrder: 3,
    },
  ]

  for (const faq of faqs) {
    const existing = await prisma.fAQ.findFirst({ where: { question: faq.question } })
    if (!existing) await prisma.fAQ.create({ data: faq })
  }
  console.log(`Seed CMS — ${faqs.length} preguntas frecuentes`)

  // Contact details match what apps/web/components/ContactSection.tsx shows.
  await prisma.siteSettings.upsert({
    where: { id: 'site' },
    update: {},
    create: {
      id: 'site',
      contactEmail: 'host@areiabela.com',
      contactPhone: '+1 (727) 555-3043',
      whatsapp: '17275553043',
      seoTitle: 'Areia Bela — Casa completa con piscina climatizada en St. Petersburg',
      seoDescription:
        'Casa de 3 dormitorios a 5 minutos de Madeira Beach. Piscina climatizada, admite mascotas, hasta 8 huéspedes.',
    },
  })
  console.log('Seed CMS — ajustes del sitio')

  // The first photos of the real listing, minus the three whose CDN URLs are
  // dead (see apps/web/lib/property-data.ts).
  const BROKEN = new Set([2484516739, 2474972136, 2474972137])
  const photos = listing.photos.filter((p) => !BROKEN.has(p.id)).slice(0, 12)

  let index = 0
  for (const photo of photos) {
    const existing = await prisma.galleryImage.findFirst({ where: { url: photo.large } })
    if (!existing) {
      await prisma.galleryImage.create({
        data: {
          url: photo.large,
          alt: photo.caption?.trim() || 'Areia Bela',
          sortOrder: index,
        },
      })
    }
    index += 1
  }
  console.log(`Seed CMS — ${photos.length} fotos de la galería`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
