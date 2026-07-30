'use client'

import { useState } from 'react'
import { Loader2, Ruler } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { ApiError } from '@/lib/api-client'
import { cms, type PropertySettings } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

interface Props {
  property: PropertySettings
  canEdit: boolean
  onSaved: () => void | Promise<void>
}

/**
 * The four numbers that decide which stays the house accepts and which ones
 * get a discount.
 *
 * They lived only in the database until now: the minimum did not exist at all,
 * and the long-stay discount was documented as editable but had no field in
 * the update DTO — saving it was impossible.
 */
export function StayRules({ property, canEdit, onSaved }: Props) {
  const t = useAdminCopy()
  const copy = t.pricing

  const [draft, setDraft] = useState({
    minNights: String(property.minNights),
    maxNights: String(property.maxNights),
    weeklyDiscountPercent: String(Number(property.weeklyDiscountPercent)),
    weeklyDiscountNights: String(property.weeklyDiscountNights),
  })
  const [busy, setBusy] = useState(false)

  const min = Number(draft.minNights)
  const max = Number(draft.maxNights)
  // Caught here as well as on the server: a minimum above the maximum makes
  // the house unbookable, and nothing else on this screen would say so.
  const invalid = !(min >= 1) || !(max >= 1) || min > max

  const save = async () => {
    setBusy(true)
    try {
      await cms.saveProperty({
        minNights: min,
        maxNights: max,
        weeklyDiscountPercent: Number(draft.weeklyDiscountPercent),
        weeklyDiscountNights: Number(draft.weeklyDiscountNights),
      })
      toast.success(copy.stayRulesSaved)
      await onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : copy.stayRulesFailed)
    } finally {
      setBusy(false)
    }
  }

  const field = (
    key: keyof typeof draft,
    label: string,
    hint: string | undefined,
    props: { min?: number; max?: number; suffix?: string } = {},
  ) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={key}
          type="number"
          inputMode="numeric"
          min={props.min}
          max={props.max}
          disabled={!canEdit}
          value={draft[key]}
          onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
          className="tabular-nums"
        />
        {props.suffix && (
          <span className="shrink-0 text-sm text-muted-foreground">{props.suffix}</span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-lg">
          <Ruler className="h-5 w-5 text-primary" />
          {copy.stayRulesTitle}
        </CardTitle>
        <CardDescription>{copy.stayRulesSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {field('minNights', copy.minNights, copy.minNightsHint, { min: 1 })}
          {field('maxNights', copy.maxNights, copy.maxNightsHint, { min: 1 })}
          {field('weeklyDiscountPercent', copy.discountPercent, copy.discountPercentHint, {
            min: 0,
            max: 100,
            suffix: '%',
          })}
          {field('weeklyDiscountNights', copy.discountNights, undefined, { min: 2 })}
        </div>

        {invalid && (
          <p role="alert" className="text-sm text-red-600">
            {copy.minAboveMax}
          </p>
        )}

        {canEdit && (
          <div className="flex justify-end">
            <Button variant="brand" onClick={() => void save()} disabled={busy || invalid}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {copy.save}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
