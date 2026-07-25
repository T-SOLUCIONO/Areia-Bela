import { PrismaClient } from '@prisma/client'
import propertyListing from '../../web/datos.json'

/**
 * Real data only (no fixtures), per docs/migration-plan.md Fase 3 and
 * docs/domain-decisions.md. Sources:
 * - apps/web/datos.json: the actual scraped Airbnb listing (name, address,
 *   amenities, pricing) that apps/web/lib/property-data.ts already reads.
 * - docs/domain-decisions.md: business rules not present in the scraped
 *   listing (extras beyond heated-pool, additional-guest fee, penalties,
 *   check-in/out times, trash days).
 *
 * Known gap, disclosed rather than papered over: no Spanish translation of
 * the property description exists yet anywhere in the codebase, so
 * descriptionEs below is the same English text as descriptionEn. Real
 * Spanish copy is Fase 5 (CMS) work.
 *
 * Only ONE PriceRule is seeded (the real flat nightly rate, $300, from the
 * live listing). Weekend/high-season rules from domain-decisions.md's
 * "seed inicial recomendado" have no real dollar figures anywhere in the
 * source material — inventing multipliers would violate "datos reales, no
 * ficticios", so those rows are intentionally left out until the property
 * owner provides real numbers.
 */

const prisma = new PrismaClient()

async function main() {
  const listing = (
    propertyListing as Array<{
      name: string
      address: string
      city: string
      country: string
      amenities: string[]
      sectionedDescription: { summary: string; description: string }
      pricing: {
        price_per_night: number
        cleaning_fee: number
        service_fee_percent: number
        taxes_percent: number
        extras: Array<{ id: string; label: string; price_per_night: number }>
      }
    }>
  )[0]

  const property = await prisma.property.upsert({
    where: { slug: 'areia-bela' },
    update: {},
    create: {
      slug: 'areia-bela',
      nameEs: listing.name,
      nameEn: listing.name,
      descriptionEs: listing.sectionedDescription.description,
      descriptionEn: listing.sectionedDescription.description,
      maxGuests: 8,
      additionalGuestFeePerNight: 30,
      cleaningFee: listing.pricing.cleaning_fee,
      serviceFeePercent: listing.pricing.service_fee_percent,
      taxesPercent: listing.pricing.taxes_percent,
      bedrooms: 3,
      bathrooms: 2,
      amenities: listing.amenities,
      address: listing.address,
      city: listing.city,
      state: 'Florida',
      country: listing.country,
      checkInTime: '16:00',
      checkOutTime: '10:00',
      trashCollectionDays: ['wednesday', 'saturday'],
    },
  })

  await prisma.priceRule.upsert({
    where: { id: `${property.id}-base-rate` },
    update: {},
    create: {
      id: `${property.id}-base-rate`,
      propertyId: property.id,
      name: 'Tarifa base',
      type: 'LOW',
      nightlyRate: listing.pricing.price_per_night,
      active: true,
    },
  })

  const extras: Array<{
    key: string
    nameEs: string
    nameEn: string
    pricingType: 'PER_NIGHT' | 'PER_HOUR' | 'PER_STAY'
    price: number
    refundable: boolean
    seasonStartMonthDay?: string
    seasonEndMonthDay?: string
    requiresRequest?: boolean
  }> = [
    {
      key: 'heated-pool',
      nameEs: 'Piscina climatizada',
      nameEn: 'Heated pool',
      pricingType: 'PER_NIGHT',
      price: listing.pricing.extras.find((e) => e.id === 'heated-pool')?.price_per_night ?? 20,
      refundable: true,
      seasonStartMonthDay: '10-01',
      seasonEndMonthDay: '05-01',
    },
    {
      key: 'certified-nanny',
      nameEs: 'Niñera certificada RCP',
      nameEn: 'Certified CPR nanny',
      pricingType: 'PER_HOUR',
      price: 20,
      refundable: true,
      requiresRequest: true,
    },
    {
      key: 'additional-guest',
      nameEs: 'Huésped adicional',
      nameEn: 'Additional guest',
      pricingType: 'PER_NIGHT',
      price: 30,
      refundable: true,
    },
    {
      key: 'pet',
      nameEs: 'Mascota (gato o perro)',
      nameEn: 'Pet (cat or dog)',
      pricingType: 'PER_STAY',
      price: 100,
      refundable: false,
    },
  ]

  for (const extra of extras) {
    await prisma.extra.upsert({
      where: { propertyId_key: { propertyId: property.id, key: extra.key } },
      update: {},
      create: { propertyId: property.id, active: true, ...extra },
    })
  }

  // Example range for calendar testing, explicitly requested as such by
  // docs/domain-decisions.md ("un rango de ejemplo para testing del
  // calendario") — not real booked dates.
  await prisma.blockedDate.upsert({
    where: { id: `${property.id}-example-blocked` },
    update: {},
    create: {
      id: `${property.id}-example-blocked`,
      propertyId: property.id,
      startDate: new Date('2026-12-24'),
      endDate: new Date('2026-12-26'),
      reason: 'Ejemplo para testing del calendario',
    },
  })

  console.log(`Seed OK — property "${property.slug}" (${property.id})`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
