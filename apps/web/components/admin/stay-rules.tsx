'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, Ruler } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Textarea } from '@areia-bela/ui/textarea'
import { unfilledPlaceholders } from '@areia-bela/shared'
import { fill } from '@/lib/admin-i18n'
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
    cleaningFee: String(Number(property.cleaningFee)),
    serviceFeePercent: String(Number(property.serviceFeePercent)),
    taxesPercent: String(Number(property.taxesPercent)),
  })
  const [policy, setPolicy] = useState(property.cancellationPolicy)
  const [accessNotes, setAccessNotes] = useState(property.accessNotes ?? '')
  // Recomputed as she types, so the warning disappears with the last bracket.
  const pending = unfilledPlaceholders(accessNotes)
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
        cleaningFee: Number(draft.cleaningFee),
        serviceFeePercent: Number(draft.serviceFeePercent),
        taxesPercent: Number(draft.taxesPercent),
        cancellationPolicy: policy,
        accessNotes: accessNotes.trim() || undefined,
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
          {/* A list, not a free number: a discount is a commercial decision
              with a handful of sensible values, and a text field invites 7.5%
              or a typo that quietly changes every price. */}
          <div className="space-y-2">
            <Label htmlFor="weeklyDiscountPercent">{copy.discountPercent}</Label>
            <select
              id="weeklyDiscountPercent"
              value={draft.weeklyDiscountPercent}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft({ ...draft, weeklyDiscountPercent: event.target.value })
              }
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="0">{copy.discountOff}</option>
              <option value="5">5 %</option>
              <option value="10">10 %</option>
              <option value="15">15 %</option>
              <option value="20">20 %</option>
            </select>
            <p className="text-xs text-muted-foreground">{copy.discountPercentHint}</p>
          </div>
          {field('weeklyDiscountNights', copy.discountNights, copy.discountNightsHint, { min: 2 })}
        </div>

        {invalid && (
          <p role="alert" className="text-sm text-red-600">
            {copy.minAboveMax}
          </p>
        )}

        <div className="space-y-5 border-t border-border pt-5">
          <div>
            <h3 className="font-medium text-foreground">{copy.feesTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{copy.feesSubtitle}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {field('cleaningFee', copy.cleaningFeeLabel, copy.cleaningFeeHint, {
              min: 0,
              suffix: '$',
            })}
            {field('serviceFeePercent', copy.serviceFeeLabel, copy.serviceFeeHint, {
              min: 0,
              max: 100,
              suffix: '%',
            })}
            {field('taxesPercent', copy.taxesLabel, copy.taxesHint, {
              min: 0,
              max: 100,
              suffix: '%',
            })}
          </div>
        </div>

        <div className="space-y-5 border-t border-border pt-5">
          <div>
            <h3 className="font-medium text-foreground">{copy.policyTitle}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{copy.policySubtitle}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancellationPolicy">{copy.policyLabel}</Label>
            <select
              id="cancellationPolicy"
              value={policy}
              disabled={!canEdit}
              onChange={(event) =>
                setPolicy(event.target.value as PropertySettings['cancellationPolicy'])
              }
              className="h-11 w-full rounded-[12px] border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="FLEXIBLE">{copy.policyFlexible}</option>
              <option value="MODERATE">{copy.policyModerate}</option>
              <option value="FIRM">{copy.policyFirm}</option>
              <option value="STRICT">{copy.policyStrict}</option>
            </select>
            {/* Said plainly, because it is the part that surprises people: the
                policy is a promise the host keeps by hand. */}
            <p className="text-xs text-amber-800">{copy.policyWarning}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessNotes">{copy.accessLabel}</Label>
            {/* Named, not just flagged: "it has placeholders" sends the host
                hunting, "these three are left" sends her to them. */}
            {pending.length > 0 && (
              <p className="flex items-start gap-2 rounded-[10px] bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {fill(copy.accessPlaceholders, {
                    count: String(pending.length),
                    list: pending.slice(0, 4).join(', ') + (pending.length > 4 ? '…' : ''),
                  })}
                </span>
              </p>
            )}
            <Textarea
              id="accessNotes"
              rows={3}
              disabled={!canEdit}
              value={accessNotes}
              onChange={(event) => setAccessNotes(event.target.value)}
              className="resize-none rounded-[12px]"
            />
            <p className="text-xs text-muted-foreground">{copy.accessHint}</p>
          </div>
        </div>

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
