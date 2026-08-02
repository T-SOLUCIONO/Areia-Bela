import { PrismaClient } from '@prisma/client'

/**
 * The three authorities a stay in Pinellas County owes.
 *
 * These are not invented: `docs/migration-plan.md` records the 13 % the house
 * charges as 6 % state + 1 % county + 6 % tourist development, and the seeded
 * `Property.taxesPercent` is 13. What this does is stop that split living only
 * in a sentence, so a return can be filed per authority.
 *
 * `effectiveFrom` is the day the house started taking bookings. Dating them
 * earlier would claim to know a rate for months nobody collected anything in.
 *
 * Idempotent, like every seed here: the natural key is the name plus the day
 * the rate started.
 */
const FIRST_BOOKING_DAY = new Date('2026-01-01T00:00:00Z')

const JURISDICTIONS = [
  {
    name: 'Impuesto estatal de Florida',
    authority: 'Florida Department of Revenue',
    percent: 6,
  },
  {
    name: 'Recargo del condado de Pinellas',
    authority: 'Florida Department of Revenue',
    percent: 1,
  },
  {
    name: 'Impuesto de desarrollo turístico',
    authority: 'Pinellas County Tax Collector',
    percent: 6,
  },
]

const prisma = new PrismaClient()

async function main() {
  for (const one of JURISDICTIONS) {
    const existing = await prisma.taxJurisdiction.findFirst({
      where: { name: one.name, effectiveFrom: FIRST_BOOKING_DAY },
    })

    if (existing) {
      await prisma.taxJurisdiction.update({
        where: { id: existing.id },
        data: { authority: one.authority, percent: one.percent },
      })
    } else {
      await prisma.taxJurisdiction.create({
        data: { ...one, effectiveFrom: FIRST_BOOKING_DAY },
      })
    }
  }

  const all = await prisma.taxJurisdiction.findMany({ where: { effectiveTo: null } })
  const sum = all.reduce((total, one) => total + Number(one.percent), 0)
  const property = await prisma.property.findFirst({ select: { taxesPercent: true } })

  console.log(`  jurisdicciones vigentes: ${all.length}`)
  for (const one of all)
    console.log(`    ${one.name.padEnd(38)} ${one.percent}%  → ${one.authority}`)
  console.log(
    `  suman ${sum}%   la casa cobra ${property?.taxesPercent}%   ${sum === Number(property?.taxesPercent) ? 'CUADRA' : '¡NO CUADRA!'}`,
  )
}

void main().finally(() => prisma.$disconnect())
