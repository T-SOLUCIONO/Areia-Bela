'use client'

import { useState } from 'react'
import { Loader2, Pencil, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@areia-bela/ui/alert-dialog'
import { Badge } from '@areia-bela/ui/badge'
import { Button } from '@areia-bela/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@areia-bela/ui/select'
import { Switch } from '@areia-bela/ui/switch'
import { ApiError } from '@/lib/api-client'
import { cms, type Extra, type ExtraPricingType } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { cn } from '@/lib/utils'

interface Props {
  extras: Extra[]
  /** Read-only for viewers: the API refuses their writes anyway. */
  canEdit: boolean
  onChanged: () => void | Promise<void>
}

export function ExtrasManager({ extras, canEdit, onChanged }: Props) {
  const t = useAdminCopy()
  const [draft, setDraft] = useState<Extra | null>(null)
  const [confirmOff, setConfirmOff] = useState<Extra | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const unitLabel: Record<ExtraPricingType, string> = {
    PER_NIGHT: t.pricing.perNight,
    PER_HOUR: t.pricing.perHour,
    PER_STAY: t.pricing.perStay,
  }

  const run = async (action: () => Promise<unknown>, success: string) => {
    setIsSaving(true)
    try {
      await action()
      await onChanged()
      toast.success(success)
      return true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.saveFailed)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const save = async () => {
    if (!draft) return
    const ok = await run(
      () =>
        cms.updateExtra(draft.id, {
          name: draft.name,
          price: Number(draft.price),
          pricingType: draft.pricingType,
          refundable: draft.refundable,
          requiresRequest: draft.requiresRequest,
          active: draft.active,
          seasonStartMonthDay: draft.seasonStartMonthDay || null,
          seasonEndMonthDay: draft.seasonEndMonthDay || null,
        }),
      t.extras.saved,
    )
    if (ok) setDraft(null)
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {extras.map((extra) => (
          <li
            key={extra.id}
            className={cn(
              'flex items-center justify-between gap-4 py-3',
              !extra.active && 'opacity-60',
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{extra.name}</p>
                {!extra.active && <Badge variant="outline">{t.extras.inactive}</Badge>}
                {extra.requiresRequest && <Badge variant="secondary">{t.pricing.onRequest}</Badge>}
                {!extra.refundable && <Badge variant="outline">{t.pricing.nonRefundable}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {extra.name}
                {extra.seasonStartMonthDay && extra.seasonEndMonthDay && (
                  <>
                    {' · '}
                    {t.pricing.seasonal} {extra.seasonStartMonthDay} → {extra.seasonEndMonthDay}
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <p className="text-right">
                <span className="font-serif text-xl tabular-nums text-foreground">
                  ${Number(extra.price).toFixed(0)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {unitLabel[extra.pricingType]}
                </span>
              </p>
              {canEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${t.extras.edit}: ${extra.name}`}
                  onClick={() => setDraft(extra)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
              {t.extras.edit}
            </DialogTitle>
            <DialogDescription>{t.extras.subtitle}</DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="extra-name">{t.extras.name}</Label>
                  <Input
                    id="extra-name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="extra-price">{t.extras.price}</Label>
                  <Input
                    id="extra-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="extra-type">{t.extras.pricingType}</Label>
                  <Select
                    value={draft.pricingType}
                    onValueChange={(pricingType: ExtraPricingType) =>
                      setDraft({ ...draft, pricingType })
                    }
                  >
                    <SelectTrigger id="extra-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PER_NIGHT">{t.extras.perNight}</SelectItem>
                      <SelectItem value="PER_HOUR">{t.extras.perHour}</SelectItem>
                      <SelectItem value="PER_STAY">{t.extras.perStay}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t.extras.season}</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="season-from">{t.extras.seasonFrom}</Label>
                    <Input
                      id="season-from"
                      placeholder="10-01"
                      value={draft.seasonStartMonthDay ?? ''}
                      onChange={(e) =>
                        setDraft({ ...draft, seasonStartMonthDay: e.target.value || null })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="season-to">{t.extras.seasonTo}</Label>
                    <Input
                      id="season-to"
                      placeholder="05-01"
                      value={draft.seasonEndMonthDay ?? ''}
                      onChange={(e) =>
                        setDraft({ ...draft, seasonEndMonthDay: e.target.value || null })
                      }
                    />
                  </div>
                </div>
              </fieldset>

              <div className="space-y-2 border-t pt-3">
                {(
                  [
                    ['active', t.extras.active],
                    ['refundable', t.extras.refundable],
                    ['requiresRequest', t.extras.requiresRequest],
                  ] as const
                ).map(([key, label]) => (
                  <Label key={key} className="flex items-center gap-2 text-sm font-normal">
                    <Switch
                      checked={draft[key]}
                      onCheckedChange={(checked) => setDraft({ ...draft, [key]: checked })}
                    />
                    {label}
                  </Label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            {draft?.active ? (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmOff(draft)}
              >
                {t.extras.deactivate}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>
                {t.common.cancel}
              </Button>
              <Button onClick={() => void save()} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {isSaving ? t.common.saving : t.common.save}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOff !== null} onOpenChange={(o) => !o && setConfirmOff(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">{t.extras.deactivate}</AlertDialogTitle>
            <AlertDialogDescription>{t.extras.deactivateConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const extra = confirmOff
                setConfirmOff(null)
                setDraft(null)
                if (extra) {
                  void run(() => cms.deactivateExtra(extra.id), t.extras.deactivated)
                }
              }}
            >
              {t.extras.deactivate}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
