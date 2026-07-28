'use client'

import { useCallback, useEffect, useState } from 'react'
import { EyeOff, Loader2 } from 'lucide-react'
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
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { TranslatableField } from '@/components/admin/content/translatable-field'
import { ImageField } from '@/components/admin/content/image-field'
import { ItemsEditor } from '@/components/admin/content/items-editor'
import { cn } from '@/lib/utils'

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
  AMENITIES: {
    eyebrow: true,
    title: true,
    body: true,
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

const ORDER: ContentSectionKey[] = [
  'HERO',
  'FEATURES',
  'AMENITIES',
  'REVIEWS',
  'LOCATION',
  'DIRECT_BOOKING',
  'HOST',
  'FOOTER',
]

export function LandingEditor() {
  const t = useAdminCopy()
  const [sections, setSections] = useState<ContentSection[] | null>(null)
  const [selected, setSelected] = useState<ContentSectionKey>('HERO')
  const [draft, setDraft] = useState<ContentSection | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setSections(await landing.sections())
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.loadFailed)
      setSections([])
    }
  }, [t.content.loadFailed])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (!sections) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,15rem)_1fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    )
  }

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
      toast.success(t.content.saved)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,15rem)_1fr]">
      <nav className="space-y-1" aria-label={t.content.landing}>
        {ORDER.map((key) => {
          const section = sections.find((row) => row.key === key)
          const isSelected = key === selected
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              aria-current={isSelected ? 'page' : undefined}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                isSelected
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span className="truncate">{t.content.sections[key]}</span>
              {section && !section.published && (
                <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </button>
          )
        })}
      </nav>

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
    </div>
  )
}
