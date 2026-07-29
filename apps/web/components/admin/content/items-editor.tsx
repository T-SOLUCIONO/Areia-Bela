'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Switch } from '@areia-bela/ui/switch'
import { ApiError } from '@/lib/api-client'
import {
  landing,
  type ContentItem,
  type ContentItemKind,
  type ContentSectionKey,
} from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { TranslatableField } from '@/components/admin/content/translatable-field'
import { IconPicker } from '@/components/admin/content/icon-picker'
import { ContentIcon } from '@/lib/content-icons'
import { ImageField } from '@/components/admin/content/image-field'
import { cn } from '@/lib/utils'

interface Props {
  sectionKey: ContentSectionKey
  kind: ContentItemKind
  items: ContentItem[]
  /** What each list actually needs — an amenity has no image or body. */
  features?: { icon?: boolean; image?: boolean; body?: boolean; value?: boolean }
  labels: { title: string; add: string; label: string; body?: string; value?: string }
  onChanged: () => Promise<void>
}

/**
 * One editor for all five landing lists — hero badges, feature cards,
 * amenities, nearby highlights and host stats. They differ only in which
 * fields they show, so `features` turns those on instead of there being five
 * near-identical components to keep in sync.
 */
export function ItemsEditor({ sectionKey, kind, items, features = {}, labels, onChanged }: Props) {
  const t = useAdminCopy()
  const [drafts, setDrafts] = useState<Record<string, ContentItem>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const rows = items.filter((item) => item.kind === kind)

  const draftFor = (item: ContentItem) => drafts[item.id] ?? item
  const isDirty = (item: ContentItem) =>
    drafts[item.id] !== undefined && JSON.stringify(drafts[item.id]) !== JSON.stringify(item)

  const edit = (item: ContentItem, patch: Partial<ContentItem>) =>
    setDrafts((prev) => ({ ...prev, [item.id]: { ...draftFor(item), ...patch } }))

  const run = async (id: string | null, action: () => Promise<unknown>, success?: string) => {
    setPendingId(id)
    try {
      await action()
      await onChanged()
      if (success) toast.success(success)
      return true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.saveFailed)
      return false
    } finally {
      setPendingId(null)
    }
  }

  const save = async (item: ContentItem) => {
    const draft = draftFor(item)
    const ok = await run(
      item.id,
      () =>
        landing.updateItem(item.id, {
          label: draft.label,
          body: draft.body,
          icon: draft.icon,
          imageUrl: draft.imageUrl,
          value: draft.value,
          published: draft.published,
        }),
      t.content.saved,
    )
    if (ok) setDrafts((prev) => ({ ...prev, [item.id]: undefined as unknown as ContentItem }))
  }

  const add = async () => {
    setIsAdding(true)
    try {
      // Placeholder labels because both languages are required; the row opens
      // ready to edit rather than the host filling a form before seeing it.
      await landing.createItem({
        sectionKey,
        kind,
        label: t.content.itemNew,
      })
      await onChanged()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.saveFailed)
    } finally {
      setIsAdding(false)
    }
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    void run(next[target].id, () => landing.reorderItems(next.map((item) => item.id)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{labels.title}</h4>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isAdding}
          onClick={() => void add()}
        >
          {isAdding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-3.5 w-3.5" aria-hidden />
          )}
          {labels.add}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {t.content.itemsEmpty}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((item, index) => {
            const draft = draftFor(item)
            return (
              <li
                key={item.id}
                className={cn(
                  'rounded-xl border bg-card p-4',
                  pendingId === item.id && 'opacity-60',
                  !draft.published && 'border-dashed',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 pt-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      aria-label={t.content.moveUp}
                      disabled={index === 0 || pendingId !== null}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      aria-label={t.content.moveDown}
                      disabled={index === rows.length - 1 || pendingId !== null}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>

                  <div className="min-w-0 flex-1 space-y-4">
                    <TranslatableField
                      label={labels.label}
                      value={draft.label}
                      onChange={(v) => edit(item, { label: v })}
                    />

                    {features.body && (
                      <TranslatableField
                        label={labels.body ?? t.content.pageBody}
                        multiline
                        rows={3}
                        value={draft.body}
                        onChange={(v) => edit(item, { body: v })}
                      />
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      {features.icon && (
                        <div className="space-y-2">
                          <Label className="text-sm">{t.content.icon}</Label>
                          <IconPicker
                            value={draft.icon}
                            onChange={(icon) => edit(item, { icon })}
                          />
                        </div>
                      )}
                      {features.value && (
                        <div className="space-y-2">
                          <Label className="text-sm" htmlFor={`value-${item.id}`}>
                            {labels.value ?? t.content.itemValue}
                          </Label>
                          <Input
                            id={`value-${item.id}`}
                            value={draft.value}
                            onChange={(event) => edit(item, { value: event.target.value })}
                          />
                        </div>
                      )}
                    </div>

                    {features.image && (
                      <ImageField
                        label={t.content.itemImage}
                        value={draft.imageUrl}
                        onChange={(imageUrl) => edit(item, { imageUrl })}
                      />
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                      <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                        <Switch
                          checked={draft.published}
                          onCheckedChange={(published) => edit(item, { published })}
                        />
                        {draft.published ? t.content.published : t.content.hidden}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={pendingId !== null}
                          onClick={() =>
                            void run(
                              item.id,
                              () => landing.deleteItem(item.id),
                              t.content.itemDeleted,
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          {t.content.faqDelete}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!isDirty(item) || pendingId !== null}
                          onClick={() => void save(item)}
                        >
                          {t.common.save}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {features.icon && (
                    <ContentIcon name={draft.icon} className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
