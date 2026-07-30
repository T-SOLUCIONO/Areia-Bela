'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarRange, DollarSign, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@areia-bela/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { ApiError } from '@/lib/api-client'
import { cms, type PropertySettings } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { useHasRole } from '@/components/admin/admin-session-provider'
import { ExtrasManager } from '@/components/admin/extras-manager'
import { StayRules } from '@/components/admin/stay-rules'

/**
 * Priced per night for the whole house, not per room type — there is one unit.
 * Every figure comes from the database, which is also what the server quotes
 * from: the browser never computes a total (CLAUDE.md).
 */
export default function PricingPage() {
  const t = useAdminCopy()
  const canEdit = useHasRole('superadmin', 'manager')
  const [property, setProperty] = useState<PropertySettings | null>(null)

  const load = useCallback(async () => {
    try {
      setProperty(await cms.property())
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <CalendarRange className="h-5 w-5 text-primary" />
            {t.pricing.seasonsTitle}
          </CardTitle>
          <CardDescription>{t.pricing.seasonsSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {seasonRules.length > 0 ? (
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
          ) : (
            /* No invented rates: docs/domain-decisions.md has no real seasonal
               figures, and making some up would be worse than showing none.
               Season rules are applied to quotes in Fase 6. */
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
