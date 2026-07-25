/**
 * Fase 3 exit criterion: "el quote server-side coincide con la UI actual".
 * Runs the real client buildQuote() (lib/booking.ts) against the real
 * server computeQuote() (@areia-bela/shared) with identical inputs built
 * from the same production pricing data (datos.json), and fails loudly on
 * any numeric mismatch. Run with: npx tsx apps/web/scripts/verify-quote-parity.ts
 */
import { buildQuote } from '@/lib/booking'
import { propertyData } from '@/lib/property-data'
import { computeQuote } from '@areia-bela/shared'

const cases: Array<{ checkIn: string; checkOut: string; extraIds: string[] }> = [
  { checkIn: '2026-08-10', checkOut: '2026-08-14', extraIds: [] },
  { checkIn: '2026-08-10', checkOut: '2026-08-14', extraIds: ['heated-pool'] },
  { checkIn: '2026-12-24', checkOut: '2026-12-31', extraIds: ['heated-pool'] },
  { checkIn: '2026-09-01', checkOut: '2026-09-02', extraIds: [] },
]

let failures = 0

for (const testCase of cases) {
  const clientQuote = buildQuote({
    checkIn: testCase.checkIn,
    checkOut: testCase.checkOut,
    guests: { adults: 2, children: 0, infants: 0, pets: 0 },
    selectedExtraIds: testCase.extraIds,
  })

  const serverQuote = computeQuote({
    checkIn: testCase.checkIn,
    checkOut: testCase.checkOut,
    selectedExtraIds: testCase.extraIds,
    pricing: {
      pricePerNight: propertyData.pricing.price_per_night,
      cleaningFee: propertyData.pricing.cleaning_fee,
      serviceFeePercent: propertyData.pricing.service_fee_percent,
      taxesPercent: propertyData.pricing.taxes_percent,
      extras: propertyData.pricing.extras.map((e) => ({
        id: e.id,
        label: e.label,
        pricePerNight: e.price_per_night,
      })),
    },
  })

  const fields: Array<keyof typeof clientQuote> = [
    'nights',
    'pricePerNight',
    'subtotal',
    'extrasTotal',
    'cleaningFee',
    'serviceFee',
    'taxes',
    'total',
  ]

  const mismatches = fields.filter(
    (field) => clientQuote[field] !== serverQuote[field as keyof typeof serverQuote],
  )

  if (mismatches.length > 0) {
    failures++
    console.error(`FAIL ${JSON.stringify(testCase)}`)
    for (const field of mismatches) {
      console.error(
        `  ${field}: client=${clientQuote[field]} server=${serverQuote[field as keyof typeof serverQuote]}`,
      )
    }
  } else {
    console.log(`OK   ${JSON.stringify(testCase)} -> total=${clientQuote.total}`)
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${cases.length} casos con discrepancia`)
  process.exit(1)
}

console.log(
  `\nTodos los ${cases.length} casos coinciden entre buildQuote() (cliente) y computeQuote() (servidor).`,
)
