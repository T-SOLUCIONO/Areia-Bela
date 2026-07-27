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

  const pages: Array<{ slug: CMSPageSlug; titleEs: string; titleEn: string; body?: string }> = [
    {
      slug: CMSPageSlug.ABOUT_SPACE,
      titleEs: 'Sobre la casa',
      titleEn: 'About the space',
      body: source.space,
    },
    {
      slug: CMSPageSlug.LOCATION,
      titleEs: 'Dónde está',
      titleEn: 'Where it is',
      body: [source.neighborhoodOverview, source.transit].filter(Boolean).join('\n\n'),
    },
    {
      slug: CMSPageSlug.HOUSE_RULES,
      titleEs: 'Normas de la casa',
      titleEn: 'House rules',
      body: source.houseRules,
    },
    {
      slug: CMSPageSlug.GUEST_ACCESS,
      titleEs: 'Antes de reservar',
      titleEn: 'Before you book',
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
        titleEs: page.titleEs,
        titleEn: page.titleEn,
        // Same text both sides: see the note above on the translation gap.
        bodyEs: body,
        bodyEn: body,
      },
    })
    created += 1
  }
  console.log(`Seed CMS — ${created} páginas con texto real del listing`)

  // These four come from docs/domain-decisions.md, which documents them in
  // Spanish, so both languages here are genuine rather than duplicated.
  const faqs = [
    {
      questionEs: '¿Puedo llevar a mi mascota?',
      questionEn: 'Can I bring my pet?',
      answerEs: 'Sí, se admiten perros y gatos. Hay un cargo de $100 por estadía, no reembolsable.',
      answerEn: 'Yes, dogs and cats are welcome. There is a $100 non-refundable fee per stay.',
      category: FAQCategory.PETS,
      sortOrder: 0,
    },
    {
      questionEs: '¿La piscina está climatizada?',
      questionEn: 'Is the pool heated?',
      answerEs:
        'La calefacción es opcional, cuesta $20 por noche y está disponible del 1 de octubre al 1 de mayo.',
      answerEn:
        'Heating is optional, costs $20 per night, and is available from 1 October to 1 May.',
      category: FAQCategory.POOL,
      sortOrder: 1,
    },
    {
      questionEs: '¿Qué días pasa el camión de la basura?',
      questionEn: 'When is the trash collected?',
      answerEs: 'Miércoles y sábado. Deja los contenedores en la acera la noche anterior.',
      answerEn: 'Wednesday and Saturday. Please put the bins out the night before.',
      category: FAQCategory.TRASH,
      sortOrder: 2,
    },
    {
      questionEs: '¿Se pueden hacer fiestas?',
      questionEn: 'Are parties allowed?',
      answerEs:
        'No. No se permiten eventos ni reuniones numerosas: queremos mantener el vecindario tranquilo.',
      answerEn:
        'No. Events and large gatherings are not allowed — we want to keep the neighbourhood quiet.',
      category: FAQCategory.PARTIES,
      sortOrder: 3,
    },
  ]

  for (const faq of faqs) {
    const existing = await prisma.fAQ.findFirst({ where: { questionEn: faq.questionEn } })
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
      seoTitleEs: 'Areia Bela — Casa completa con piscina climatizada en St. Petersburg',
      seoTitleEn: 'Areia Bela — Whole home with heated pool in St. Petersburg',
      seoDescriptionEs:
        'Casa de 3 dormitorios a 5 minutos de Madeira Beach. Piscina climatizada, admite mascotas, hasta 8 huéspedes.',
      seoDescriptionEn:
        'Three-bedroom house five minutes from Madeira Beach. Heated pool, pet friendly, sleeps eight.',
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
          altEs: photo.caption?.trim() || 'Areia Bela',
          altEn: photo.caption?.trim() || 'Areia Bela',
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
