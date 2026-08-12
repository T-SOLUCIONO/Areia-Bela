'use client'

import { useState } from 'react'
import { CalendarRange, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@areia-bela/ui/dialog'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { apiFetch } from '@/lib/api-client'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'

type SeasonType = 'LOW' | 'HIGH' | 'WEEKEND'

export interface PriceRule {
  id: string
  name: string
  type: SeasonType
  startDate: string | null
  endDate: string | null
  nightlyRate: number
  minNights: number | null
  active: boolean
}

interface Draft {
  id: string | null
  name: string
  type: SeasonType
  startDate: string
  endDate: string
  nightlyRate: string
  minNights: string
}

const BLANK: Draft = {
  id: null,
  name: '',
  type: 'HIGH',
  startDate: '',
  endDate: '',
  nightlyRate: '',
  minNights: '',
}

/**
 * The seasons, editable at last.
 *
 * They were read-only: a peak week could only exist by seeding the database,
 * which meant a host who wanted one had to ask a developer. The minimum-nights
 * column made that untenable — a rule nobody can write is a rule that never
 * applies.
 *
 * The rate is not the only thing a season decides. Christmas asking for seven
 * nights is what stops one night taking the whole week off the calendar.
 */
export function SeasonRules({
  slug,
  rules,
  onChange,
}: {
  slug: string
  rules: PriceRule[]
  onChange: (rules: PriceRule[]) => void
}) {
  const { t } = useAdminLanguage()
  const copy = t.pricing

  const [draft, setDraft] = useState<Draft | null>(null)
  const [removing, setRemoving] = useState<PriceRule | null>(null)
  const [busy, setBusy] = useState(false)

  // The base rate is not a season and has no dates; it is edited with the
  // nightly price above. Only what the host can actually manage shows here.
  const seasons = rules.filter((rule) => rule.type !== 'LOW')

  const dated = draft?.type === 'HIGH'

  const ready =
    draft !== null &&
    draft.name.trim() !== '' &&
    Number(draft.nightlyRate) > 0 &&
    (!dated || (draft.startDate !== '' && draft.endDate !== '' && draft.startDate <= draft.endDate))

  const save = async () => {
    if (!draft || !ready) return
    setBusy(true)
    try {
      const body = {
        name: draft.name.trim(),
        nightlyRate: Number(draft.nightlyRate),
        // Empty clears it, which hands the floor back to the house minimum.
        minNights: draft.minNights === '' ? null : Number(draft.minNights),
        ...(dated ? { startDate: draft.startDate, endDate: draft.endDate } : {}),
      }

      const next = draft.id
        ? await apiFetch<PriceRule[]>(`/properties/price-rules/${draft.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await apiFetch<PriceRule[]>(`/properties/${slug}/price-rules`, {
            method: 'POST',
            body: JSON.stringify({ ...body, type: draft.type }),
          })

      onChange(next)
      toast.success(copy.seasonSaved)
      setDraft(null)
    } catch (error) {
      // The API says which rule was broken — overlapping dates, a duplicate
      // weekend rule — and that is worth more than a generic failure.
      toast.error(error instanceof Error ? error.message : copy.seasonSaveFailed)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      onChange(
        await apiFetch<PriceRule[]>(`/properties/price-rules/${removing.id}`, { method: 'DELETE' }),
      )
      toast.success(copy.seasonDeleted)
      setRemoving(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.seasonDeleteFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <CalendarRange className="h-5 w-5 text-primary" />
            {copy.seasonsTitle}
          </CardTitle>
          <CardDescription className="mt-1">{copy.seasonsSubtitle}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDraft(BLANK)}>
          <Plus className="h-4 w-4" />
          {copy.addSeason}
        </Button>
      </CardHeader>

      <CardContent>
        {seasons.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {copy.noSeasonRules}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {seasons.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{rule.name}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {rule.type === 'HIGH' ? copy.seasonHigh : copy.seasonWeekend}
                    </span>
                    {/* Named, because a number beside a price would read as
                        part of the price. */}
                    {rule.minNights !== null && (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700 ring-1 ring-inset ring-sky-200">
                        {fill(copy.seasonMinNightsBadge, { count: String(rule.minNights) })}
                      </span>
                    )}
                    {!rule.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {copy.seasonInactive}
                      </span>
                    )}
                  </div>
                  {rule.startDate && rule.endDate && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {rule.startDate} → {rule.endDate}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-serif text-xl tabular-nums text-foreground">
                    ${rule.nightlyRate.toFixed(0)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={copy.editSeason}
                    onClick={() =>
                      setDraft({
                        id: rule.id,
                        name: rule.name,
                        type: rule.type,
                        startDate: rule.startDate ?? '',
                        endDate: rule.endDate ?? '',
                        nightlyRate: String(rule.nightlyRate),
                        minNights: rule.minNights === null ? '' : String(rule.minNights),
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={copy.seasonDelete}
                    onClick={() => setRemoving(rule)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && !busy && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {draft?.id ? copy.editSeason : copy.addSeason}
            </DialogTitle>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="season-name">{copy.seasonName}</Label>
                <Input
                  id="season-name"
                  value={draft.name}
                  placeholder={copy.seasonNamePlaceholder}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </div>

              {/* The kind is fixed once created: changing HIGH to WEEKEND would
                  mean dropping the dates and could collide with the existing
                  weekend rule. Delete and add instead. */}
              {!draft.id && (
                <div className="space-y-2">
                  <Label htmlFor="season-type">{copy.seasonType}</Label>
                  <select
                    id="season-type"
                    value={draft.type}
                    onChange={(event) =>
                      setDraft({ ...draft, type: event.target.value as SeasonType })
                    }
                    className="h-10 w-full rounded-[10px] border border-border bg-transparent px-3 text-sm"
                  >
                    <option value="HIGH">{copy.seasonHigh}</option>
                    <option value="WEEKEND">{copy.seasonWeekend}</option>
                  </select>
                </div>
              )}

              {dated ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="season-from">{copy.seasonFrom}</Label>
                    <Input
                      id="season-from"
                      type="date"
                      value={draft.startDate}
                      onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="season-to">{copy.seasonTo}</Label>
                    <Input
                      id="season-to"
                      type="date"
                      min={draft.startDate || undefined}
                      value={draft.endDate}
                      onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <p className="rounded-[10px] bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  {copy.seasonDatedOnly}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="season-rate">{copy.seasonRate}</Label>
                  <Input
                    id="season-rate"
                    type="number"
                    min="1"
                    step="1"
                    value={draft.nightlyRate}
                    onChange={(event) => setDraft({ ...draft, nightlyRate: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="season-min">{copy.seasonMinNights}</Label>
                  <Input
                    id="season-min"
                    type="number"
                    min="1"
                    step="1"
                    value={draft.minNights}
                    onChange={(event) => setDraft({ ...draft, minNights: event.target.value })}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{copy.seasonMinNightsHint}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => void save()} disabled={!ready || busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {copy.seasonSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {fill(copy.seasonDeleteTitle, { name: removing?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>{copy.seasonDeleteLead}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)} disabled={busy}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {copy.seasonDelete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
