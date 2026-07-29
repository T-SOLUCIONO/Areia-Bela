import { PrismaClient } from '@prisma/client'
import * as argon2 from 'argon2'
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
 * description below is the same English text as description. Real
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
      name: listing.name,
      description: listing.sectionedDescription.description,
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
    name: string
    pricingType: 'PER_NIGHT' | 'PER_HOUR' | 'PER_STAY'
    price: number
    refundable: boolean
    seasonStartMonthDay?: string
    seasonEndMonthDay?: string
    requiresRequest?: boolean
  }> = [
    {
      key: 'heated-pool',
      name: 'Piscina climatizada',
      pricingType: 'PER_NIGHT',
      price: listing.pricing.extras.find((e) => e.id === 'heated-pool')?.price_per_night ?? 20,
      refundable: true,
      seasonStartMonthDay: '10-01',
      seasonEndMonthDay: '05-01',
    },
    {
      key: 'certified-nanny',
      name: 'Niñera certificada RCP',
      pricingType: 'PER_HOUR',
      price: 20,
      refundable: true,
      requiresRequest: true,
    },
    {
      key: 'additional-guest',
      name: 'Huésped adicional',
      pricingType: 'PER_NIGHT',
      price: 30,
      refundable: true,
    },
    {
      key: 'pet',
      name: 'Mascota (gato o perro)',
      pricingType: 'PER_STAY',
      price: 115,
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

  // Fase 4: the admin account. Email is fixed by docs/domain-decisions.md;
  // the password is not documented anywhere, so it comes from the environment
  // rather than being invented here. Failing loudly is deliberate — a silent
  // fallback would be exactly the weak default this phase exists to remove.
  const adminPassword = process.env.ADMIN_SEED_PASSWORD
  if (!adminPassword) {
    throw new Error(
      'ADMIN_SEED_PASSWORD is not set. Set it (see docs/env.md) before seeding; ' +
        'the admin user is not created with a default password.',
    )
  }
  if (adminPassword.length < 12) {
    throw new Error('ADMIN_SEED_PASSWORD must be at least 12 characters.')
  }

  const adminEmail = 'admin@areiabela.com'
  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id })

  // Only the hash is updated on re-run, so the seed stays idempotent without
  // resetting role/active state an operator may have changed since.
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'Areia Bela',
      lastName: 'Admin',
      role: 'SUPERADMIN',
    },
  })

  console.log(`Seed OK — property "${property.slug}" (${property.id})`)
  console.log(`Seed OK — admin user "${admin.email}" (${admin.role})`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
