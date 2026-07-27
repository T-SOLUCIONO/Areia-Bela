'use client'

import { CalendarRange, DollarSign, Sparkles } from 'lucide-react'
import { Badge } from '@areia-bela/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import {
  ADDITIONAL_GUEST_FEE_PER_NIGHT,
  HEATED_POOL_SEASON,
  NANNY_PRICE_PER_HOUR,
  PET_FEE_PER_STAY,
} from '@areia-bela/shared'
import { propertyData } from '@/lib/property-data'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'

/**
 * Priced per night for the whole house, not per room type — there is one unit.
 * The base rate, cleaning fee and extras are the property's real figures
 * (datos.json and docs/domain-decisions.md); only the season rules are still
 * unbuilt, and the page says so rather than inventing rates.
 */
export default function PricingPage() {
  const { language, t } = useAdminLanguage()
  const isEnglish = language === 'en'

  const { price_per_night: baseRate, cleaning_fee: cleaningFee } = propertyData.pricing

  const extras = [
    {
      name: isEnglish ? 'Heated pool' : 'Piscina climatizada',
      amount: `$${HEATED_POOL_SEASON.pricePerNight}`,
      unit: t.pricing.perNight,
      note: `${t.pricing.seasonal} · ${HEATED_POOL_SEASON.startMonthDay} → ${HEATED_POOL_SEASON.endMonthDay}`,
    },
    {
      name: isEnglish ? 'Extra guest' : 'Huésped adicional',
      amount: `$${ADDITIONAL_GUEST_FEE_PER_NIGHT}`,
      unit: t.pricing.perNight,
      note: isEnglish
        ? `Above ${propertyData.capacity} guests`
        : `A partir de ${propertyData.capacity} huéspedes`,
    },
    {
      name: isEnglish ? 'Pet' : 'Mascota',
      amount: `$${PET_FEE_PER_STAY}`,
      unit: t.pricing.perStay,
      note: t.pricing.nonRefundable,
    },
    {
      name: isEnglish ? 'Certified nanny' : 'Niñera certificada',
      amount: `$${NANNY_PRICE_PER_HOUR}`,
      unit: t.pricing.perHour,
      note: t.pricing.onRequest,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.pricing.baseTitle}</CardDescription>
            <CardTitle className="font-serif text-4xl tabular-nums">${baseRate}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t.pricing.perNight} · {t.pricing.baseSubtitle}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.pricing.cleaningFee}</CardDescription>
            <CardTitle className="font-serif text-4xl tabular-nums">${cleaningFee}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t.pricing.perStay}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            {t.pricing.extrasTitle}
          </CardTitle>
          <CardDescription>{t.pricing.extrasSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {extras.map((extra) => (
              <li key={extra.name} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{extra.name}</p>
                  <p className="text-sm text-muted-foreground">{extra.note}</p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="font-serif text-xl tabular-nums text-foreground">
                    {extra.amount}
                  </span>
                  <span className="block text-xs text-muted-foreground">{extra.unit}</span>
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <CalendarRange className="h-5 w-5 text-primary" />
            {t.pricing.seasonsTitle}
          </CardTitle>
          <CardDescription>{t.pricing.seasonsSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* No invented rates: docs/domain-decisions.md has no real seasonal
              figures, and making some up would be worse than showing none. */}
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-border p-6">
            <DollarSign className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm text-foreground">{t.pricing.noSeasonRules}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{t.pricing.seasonLow}</Badge>
                <Badge variant="outline">{t.pricing.seasonHigh}</Badge>
                <Badge variant="outline">{t.pricing.seasonWeekend}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
