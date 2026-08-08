'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@areia-bela/ui/badge'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { Switch } from '@areia-bela/ui/switch'
import { ApiError } from '@/lib/api-client'
import {
  landing,
  type ContentItemKind,
  type ContentSection,
  type ContentSectionKey,
} from '@/lib/cms-client'
import { useAdminCopy, useAdminCopyRef } from '@/components/admin/admin-language-provider'
import { TranslatableField } from '@/components/admin/content/translatable-field'
import { ImageField } from '@/components/admin/content/image-field'
import { ItemsEditor } from '@/components/admin/content/items-editor'

/**
 * Which slots each section actually uses. Driving the form from this table
 * keeps the eight sections from becoming eight bespoke forms, and makes it
 * obvious what a section is made of.
 */
const LAYOUT: Record<
  ContentSectionKey,
  {
    eyebrow?: boolean
    title?: boolean
    subtitle?: boolean
    body?: boolean
    cta?: boolean
    stat?: boolean
    image?: boolean
    link?: boolean
    canHide?: boolean
    items?: {
      kind: ContentItemKind
      features: { icon?: boolean; image?: boolean; body?: boolean; value?: boolean }
    }
  }
> = {
  HERO: {
    title: true,
    subtitle: true,
    body: true,
    cta: true,
    items: { kind: 'HERO_BADGE', features: { icon: true } },
  },
  FEATURES: {
    title: true,
    canHide: true,
    items: { kind: 'FEATURE_CARD', features: { icon: true, image: true, body: true } },
  },
  // Only the eyebrow: the amenity tags now render inside the "everything
  // about the house" card, which brings its own heading. A title and lead
  // that no longer appear anywhere would be controls that pretend to save.
  AMENITIES: {
    eyebrow: true,
    canHide: true,
    items: { kind: 'AMENITY', features: { icon: true } },
  },
  REVIEWS: {
    eyebrow: true,
    title: true,
    stat: true,
    canHide: true,
    items: { kind: 'REVIEW_RATING', features: { value: true } },
  },
  LOCATION: {
    title: true,
    subtitle: true,
    body: true,
    link: true,
    canHide: true,
    items: { kind: 'LOCATION_HIGHLIGHT', features: { icon: true } },
  },
  DIRECT_BOOKING: { title: true, body: true, cta: true, canHide: true },
  HOST: {
    eyebrow: true,
    title: true,
    subtitle: true,
    body: true,
    cta: true,
    stat: true,
    image: true,
    canHide: true,
    items: { kind: 'HOST_STAT', features: { icon: true, value: true } },
  },
  FOOTER: { body: true },
}

interface Props {
  /** Which section to edit. The rail above owns the choice now. */
  selected: ContentSectionKey
  /** Lets the rail refresh its badges after a save changes one. */
  onSaved?: () => void | Promise<void>
}

export function LandingEditor({ selected, onSaved }: Props) {
  const t = useAdminCopy()
  const copyRef = useAdminCopyRef()
  const [sections, setSections] = useState<ContentSection[] | null>(null)
  const [draft, setDraft] = useState<ContentSection | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setSections(await landing.sections())
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : copyRef.current.content.loadFailed)
      setSections([])
    }
  }, [copyRef])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (!sections) return <Skeleton className="h-96" />

  const stored = sections.find((section) => section.key === selected)
  const current = draft?.key === selected ? draft : stored
  const layout = LAYOUT[selected]

  const isDirty = Boolean(
    current &&
    stored &&
    JSON.stringify({ ...current, items: [] }) !== JSON.stringify({ ...stored, items: [] }),
  )

  const edit = (patch: Partial<ContentSection>) => {
    if (current) setDraft({ ...current, ...patch })
  }

  const save = async () => {
    if (!current) return
    setIsSaving(true)
    try {
      await landing.saveSection(selected, {
        eyebrow: current.eyebrow,
        title: current.title,
        subtitle: current.subtitle,
        body: current.body,
        ctaLabel: current.ctaLabel,
        ctaHref: current.ctaHref,
        statValue: current.statValue,
        statLabel: current.statLabel,
        imageUrl: current.imageUrl,
        linkUrl: current.linkUrl,
        published: current.published,
      })
      setDraft(null)
      await load()
      await onSaved?.()
      toast.success(t.content.saved)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-lg">{t.content.sections[selected]}</h3>
          {current && !current.published && <Badge variant="outline">{t.content.hidden}</Badge>}
        </div>
        <div className="flex items-center gap-3">
          {layout.canHide && current && (
            <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Switch
                checked={current.published}
                onCheckedChange={(published) => edit({ published })}
              />
              {current.published ? t.content.sectionShown : t.content.sectionHidden}
            </Label>
          )}
          <Button onClick={() => void save()} disabled={!isDirty || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {isSaving ? t.common.saving : t.common.save}
          </Button>
        </div>
      </div>

      {current && (
        <div className="space-y-5 rounded-xl border bg-card p-5">
          {layout.eyebrow && (
            <TranslatableField
              label={t.content.fieldEyebrow}
              value={current.eyebrow}
              onChange={(v) => edit({ eyebrow: v })}
            />
          )}
          {layout.title && (
            <TranslatableField
              label={t.content.fieldTitle}
              value={current.title}
              onChange={(v) => edit({ title: v })}
            />
          )}
          {layout.subtitle && (
            <TranslatableField
              label={t.content.fieldSubtitle}
              value={current.subtitle}
              onChange={(v) => edit({ subtitle: v })}
            />
          )}
          {layout.body && (
            <TranslatableField
              label={t.content.fieldBody}
              multiline
              rows={4}
              value={current.body}
              onChange={(v) => edit({ body: v })}
            />
          )}

          {layout.cta && (
            <div className="space-y-4 border-t pt-4">
              <TranslatableField
                label={t.content.fieldCta}
                value={current.ctaLabel}
                onChange={(v) => edit({ ctaLabel: v })}
              />
              <div className="space-y-1.5">
                <Label htmlFor="cta-href">{t.content.fieldCtaHref}</Label>
                <Input
                  id="cta-href"
                  value={current.ctaHref}
                  placeholder="#reservar"
                  onChange={(event) => edit({ ctaHref: event.target.value })}
                />
              </div>
            </div>
          )}

          {layout.stat && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="stat-value">{t.content.fieldStatValue}</Label>
                <Input
                  id="stat-value"
                  value={current.statValue}
                  className="max-w-40"
                  onChange={(event) => edit({ statValue: event.target.value })}
                />
              </div>
              <TranslatableField
                label={t.content.fieldStatLabel}
                value={current.statLabel}
                onChange={(v) => edit({ statLabel: v })}
              />
            </div>
          )}

          {layout.image && (
            <div className="border-t pt-4">
              <ImageField
                label={t.content.fieldImage}
                shape="square"
                value={current.imageUrl}
                onChange={(imageUrl) => edit({ imageUrl })}
              />
            </div>
          )}

          {layout.link && (
            <div className="space-y-1.5 border-t pt-4">
              <Label htmlFor="link-url">{t.content.fieldMap}</Label>
              <Input
                id="link-url"
                value={current.linkUrl ?? ''}
                placeholder="https://www.google.com/maps/embed?..."
                onChange={(event) => edit({ linkUrl: event.target.value || null })}
              />
              <p className="text-xs text-muted-foreground">{t.content.fieldMapHint}</p>
            </div>
          )}
        </div>
      )}

      {layout.items && stored && (
        <div className="rounded-xl border bg-card p-5">
          <ItemsEditor
            sectionKey={selected}
            kind={layout.items.kind}
            items={stored.items}
            features={layout.items.features}
            labels={{
              title: t.content.itemLists[layout.items.kind],
              add: t.content.itemAdd,
              label: t.content.itemLabel,
              body: t.content.itemBody,
              value: t.content.itemValue,
            }}
            onChanged={load}
          />
        </div>
      )}
    </div>
  )
}
