'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@areia-bela/ui/badge'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { Switch } from '@areia-bela/ui/switch'
import { Textarea } from '@areia-bela/ui/textarea'
import { ApiError } from '@/lib/api-client'
import { TranslatableField } from '@/components/admin/content/translatable-field'
import { cms, type CMSPage, type CMSPageSlug } from '@/lib/cms-client'
import { useAdminCopy, useAdminCopyRef } from '@/components/admin/admin-language-provider'
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
    title: title,
    body: '',
    published: true,
    updatedAt: '',
  }
}

interface Props {
  /** Which page to edit. The rail above owns the choice now. */
  selected: CMSPageSlug
  /** Lets the rail refresh its badges after a save fills one in. */
  onSaved?: () => void | Promise<void>
}

export function PagesEditor({ selected, onSaved }: Props) {
  const t = useAdminCopy()
  const copyRef = useAdminCopyRef()
  const [pages, setPages] = useState<Record<string, CMSPage>>({})
  const [draft, setDraft] = useState<CMSPage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const rows = await cms.pages()
      setPages(Object.fromEntries(rows.map((page) => [page.slug, page])))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : copyRef.current.content.loadFailed)
    } finally {
      setIsLoading(false)
    }
  }, [copyRef])

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
    current.title.trim() && current.title.trim() && current.body.trim() && current.body.trim(),
  )

  const edit = (patch: Partial<CMSPage>) => setDraft({ ...current, ...patch })

  const save = async () => {
    setIsSaving(true)
    try {
      const saved = await cms.savePage(selected, {
        title: current.title,
        body: current.body,
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

  if (isLoading) return <Skeleton className="h-96" />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="font-serif text-lg">{t.content.slugs[selected]}</h2>
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

      <div className="space-y-4 rounded-xl border bg-card p-4">
        <TranslatableField
          id="page-title"
          label={t.content.pageTitle}
          value={current.title}
          onChange={(title) => edit({ title })}
        />
        <TranslatableField
          id="page-body"
          label={t.content.pageBody}
          multiline
          rows={16}
          value={current.body}
          onChange={(body) => edit({ body })}
        />
      </div>

      {isDirty && (
        <p className="text-sm text-muted-foreground">
          {isComplete ? t.content.unsaved : t.content.pageIncomplete}
        </p>
      )}
    </div>
  )
}
