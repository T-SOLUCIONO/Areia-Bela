'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarRange, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { apiFetch, ApiError } from '@/lib/api-client'
import { PROPERTY_SLUG } from '@/lib/property-data'
import { cms, type PropertySettings } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { useHasRole } from '@/components/admin/admin-session-provider'
import { ExtrasManager } from '@/components/admin/extras-manager'
import { StayRules } from '@/components/admin/stay-rules'
import { SeasonRules, type PriceRule } from '@/components/admin/season-rules'

/**
 * Priced per night for the whole house, not per room type — there is one unit.
 * Every figure comes from the database, which is also what the server quotes
 * from: the browser never computes a total (CLAUDE.md).
 */
export default function PricingPage() {
  const t = useAdminCopy()
  const canEdit = useHasRole('superadmin', 'manager')
  const [property, setProperty] = useState<PropertySettings | null>(null)
  // Held apart from the property so saving a season re-renders just this list,
  // rather than refetching the whole screen for a rate change.
  const [rules, setRules] = useState<PriceRule[] | null>(null)

  const load = useCallback(async () => {
    try {
      // Two calls on purpose. `GET /properties/:slug` returns Prisma's Decimal
      // as a string and hides inactive rules; the seasons endpoint returns
      // numbers and everything the host can edit. Casting one into the other
      // would have shipped a `.toFixed()` on a string.
      const [next, seasons] = await Promise.all([
        cms.property(),
        apiFetch<PriceRule[]>(`/properties/${PROPERTY_SLUG}/price-rules`),
      ])
      setProperty(next)
      setRules(seasons)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.property.loadFailed)
    }
  }, [t.property.loadFailed])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (!property) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const baseRule = property.priceRules.find((rule) => rule.type === 'LOW' && rule.active)
  const seasonRules = property.priceRules.filter((rule) => rule.type !== 'LOW')

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.pricing.baseTitle}</CardDescription>
            <CardTitle className="font-serif text-4xl tabular-nums">
              {baseRule ? `$${Number(baseRule.nightlyRate).toFixed(0)}` : '—'}
            </CardTitle>
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
            <CardTitle className="font-serif text-4xl tabular-nums">
              ${Number(property.cleaningFee).toFixed(0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t.pricing.perStay}</p>
          </CardContent>
        </Card>
      </div>

      <StayRules
        // Remounts on save so the inputs show what was stored, not what was
        // typed — the server can clamp or reject either of them.
        key={`${property.minNights}-${property.maxNights}-${property.weeklyDiscountNights}`}
        property={property}
        canEdit={canEdit}
        onSaved={load}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            {t.pricing.extrasTitle}
          </CardTitle>
          <CardDescription>{t.pricing.extrasSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <ExtrasManager extras={property.extras} canEdit={canEdit} onChanged={load} />
        </CardContent>
      </Card>

      {/* Editable at last. It was a read-only list, so a peak season could
          only be created by seeding the database. */}
      {canEdit ? (
        <SeasonRules slug={property.slug} rules={rules ?? []} onChange={setRules} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <CalendarRange className="h-5 w-5 text-primary" />
              {t.pricing.seasonsTitle}
            </CardTitle>
            <CardDescription>{t.pricing.seasonsSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            {seasonRules.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {t.pricing.noSeasonRules}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {seasonRules.map((rule) => (
                  <li key={rule.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-medium">{rule.name}</p>
                      {rule.startDate && rule.endDate && (
                        <p className="text-sm text-muted-foreground">
                          {rule.startDate.slice(0, 10)} → {rule.endDate.slice(0, 10)}
                        </p>
                      )}
                    </div>
                    <span className="font-serif text-xl tabular-nums">
                      ${Number(rule.nightlyRate).toFixed(0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
