'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, FileText, Languages, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@areia-bela/ui/badge'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { Switch } from '@areia-bela/ui/switch'
import { Textarea } from '@areia-bela/ui/textarea'
import { ApiError } from '@/lib/api-client'
import { cms, needsTranslation, type CMSPage, type CMSPageSlug } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'
import { cn } from '@/lib/utils'

/** The twelve slugs, in the order the guest site reads them. */
const SLUGS: CMSPageSlug[] = [
  'ABOUT_SPACE',
  'ACCOMMODATION',
  'LIVING_AREAS',
  'KITCHEN_DINING',
  'BEDROOMS_BATHROOMS',
  'OUTDOOR_LIFE',
  'AMENITIES',
  'LOCATION',
  'GUEST_ACCESS',
  'HOUSE_RULES',
  'FAQS',
  'POLICIES',
]

/** A slug with no row yet: the PATCH endpoint upserts it on first save. */
function blankPage(slug: CMSPageSlug, title: string): CMSPage {
  return {
    id: slug,
    slug,
    titleEs: title,
    titleEn: title,
    bodyEs: '',
    bodyEn: '',
    published: true,
    updatedAt: '',
  }
}

export function PagesEditor() {
  const t = useAdminCopy()
  const [pages, setPages] = useState<Record<string, CMSPage>>({})
  const [selected, setSelected] = useState<CMSPageSlug>('ABOUT_SPACE')
  const [draft, setDraft] = useState<CMSPage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const rows = await cms.pages()
      setPages(Object.fromEntries(rows.map((page) => [page.slug, page])))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.loadFailed)
    } finally {
      setIsLoading(false)
    }
  }, [t.content.loadFailed])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  // The draft follows the selection, and resets whenever the stored row for
  // that slug changes (i.e. after a save).
  const stored = pages[selected] ?? blankPage(selected, t.content.slugs[selected])
  const current = draft?.slug === selected ? draft : stored
  const isDirty = draft?.slug === selected && JSON.stringify(draft) !== JSON.stringify(stored)
  // The API rejects a page with an empty side, on purpose: publishing half a
  // translation is the failure this screen exists to prevent. Mirror that here
  // so the button doesn't offer a save that will bounce.
  const isComplete = Boolean(
    current.titleEs.trim() &&
    current.titleEn.trim() &&
    current.bodyEs.trim() &&
    current.bodyEn.trim(),
  )

  const edit = (patch: Partial<CMSPage>) => setDraft({ ...current, ...patch })

  const save = async () => {
    setIsSaving(true)
    try {
      const saved = await cms.savePage(selected, {
        titleEs: current.titleEs,
        titleEn: current.titleEn,
        bodyEs: current.bodyEs,
        bodyEn: current.bodyEn,
        published: current.published,
      })
      setPages((prev) => ({ ...prev, [saved.slug]: saved }))
      setDraft(null)
      toast.success(t.content.saved)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,15rem)_1fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  const written = SLUGS.filter((slug) => pages[slug]?.bodyEs.trim())
  const translated = written.filter((slug) => !needsTranslation(pages[slug]))

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_1fr]">
      <nav className="space-y-1" aria-label={t.content.pages}>
        <p className="px-3 pb-2 text-xs text-muted-foreground">
          {fill(t.content.pageCount, {
            done: String(translated.length),
            total: String(written.length),
          })}
        </p>
        {SLUGS.map((slug) => {
          const page = pages[slug]
          const isSelected = slug === selected
          return (
            <button
              key={slug}
              type="button"
              onClick={() => setSelected(slug)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                isSelected
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              aria-current={isSelected ? 'page' : undefined}
            >
              <span className="truncate">{t.content.slugs[slug]}</span>
              {page && !needsTranslation(page) ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              ) : page ? (
                <Languages
                  className="h-3.5 w-3.5 shrink-0 text-amber-600"
                  aria-label={t.content.untranslated}
                />
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="font-serif text-lg">{t.content.slugs[selected]}</h2>
            {needsTranslation(current) && current.bodyEn.trim() !== '' && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                {t.content.untranslated}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Switch
                checked={current.published}
                onCheckedChange={(published) => edit({ published })}
              />
              {current.published ? t.content.published : t.content.hidden}
            </Label>
            <Button onClick={() => void save()} disabled={!isDirty || !isComplete || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {isSaving ? t.common.saving : t.common.save}
            </Button>
          </div>
        </div>

        {needsTranslation(current) && current.bodyEn.trim() !== '' && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
            {t.content.untranslatedHint}
          </p>
        )}

        {/* Side by side rather than a language toggle: translating means
            reading one column while writing the other. */}
        <div className="grid gap-5 lg:grid-cols-2">
          {(
            [
              ['es', t.content.spanish, 'titleEs', 'bodyEs'],
              ['en', t.content.english, 'titleEn', 'bodyEn'],
            ] as const
          ).map(([code, label, titleKey, bodyKey]) => (
            <div key={code} className="space-y-3 rounded-xl border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor={`title-${code}`}>{t.content.pageTitle}</Label>
                <Input
                  id={`title-${code}`}
                  value={current[titleKey]}
                  onChange={(event) => edit({ [titleKey]: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`body-${code}`}>{t.content.pageBody}</Label>
                <Textarea
                  id={`body-${code}`}
                  rows={16}
                  value={current[bodyKey]}
                  onChange={(event) => edit({ [bodyKey]: event.target.value })}
                  className="resize-y font-sans leading-relaxed"
                />
              </div>
            </div>
          ))}
        </div>

        {isDirty && (
          <p className="text-sm text-muted-foreground">
            {isComplete ? t.content.unsaved : t.content.bothLanguagesRequired}
          </p>
        )}
      </div>
    </div>
  )
}
