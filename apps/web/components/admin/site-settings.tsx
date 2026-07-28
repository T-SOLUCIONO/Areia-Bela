'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { Textarea } from '@areia-bela/ui/textarea'
import { ApiError } from '@/lib/api-client'
import { cms, type SiteSettings as Settings } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { ImageField } from '@/components/admin/content/image-field'

const BLANK: Settings = {
  contactEmail: '',
  contactPhone: '',
  whatsapp: '',
  seoTitle: '',
  seoDescription: '',
  instagramUrl: null,
  facebookUrl: null,
  airbnbUrl: null,
  logoUrl: null,
}

export function SiteSettings() {
  const t = useAdminCopy()
  const [stored, setStored] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Settings | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      // Null when the row has never been written; the PATCH upserts it.
      const settings = (await cms.settings()) ?? BLANK
      setStored(settings)
      setDraft(settings)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.loadFailed)
    }
  }, [t.content.loadFailed])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (!draft || !stored) {
    return (
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(stored)
  const edit = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch })

  const save = async () => {
    setIsSaving(true)
    try {
      const saved = await cms.saveSettings(draft)
      setStored(saved)
      setDraft(saved)
      toast.success(t.property.saved)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.property.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">{t.site.contactEmail}</Label>
          <Input
            id="contact-email"
            type="email"
            value={draft.contactEmail}
            onChange={(e) => edit({ contactEmail: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">{t.site.contactPhone}</Label>
          <Input
            id="contact-phone"
            type="tel"
            value={draft.contactPhone}
            onChange={(e) => edit({ contactPhone: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">{t.site.whatsapp}</Label>
          <Input
            id="whatsapp"
            inputMode="numeric"
            value={draft.whatsapp}
            onChange={(e) => edit({ whatsapp: e.target.value.replace(/\D/g, '') })}
          />
          <p className="text-xs text-muted-foreground">{t.site.whatsappHint}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-serif text-base">SEO</h3>
          <p className="text-sm text-muted-foreground">{t.site.seoHint}</p>
        </div>
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="seoTitle">{t.site.seoTitle}</Label>
            <Input
              id="seoTitle"
              value={draft.seoTitle}
              onChange={(e) => edit({ seoTitle: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seoDescription">{t.site.seoDescription}</Label>
            <Textarea
              id="seoDescription"
              rows={3}
              value={draft.seoDescription}
              onChange={(e) => edit({ seoDescription: e.target.value })}
            />
            <p className="text-right text-xs text-muted-foreground">
              {draft.seoDescription.length} / 155
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-base">{t.content.logo}</h3>
        <ImageField
          label={t.content.logo}
          value={draft.logoUrl}
          onChange={(logoUrl) => edit({ logoUrl })}
        />
        <p className="text-xs text-muted-foreground">{t.content.logoHint}</p>
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-base">{t.site.links}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ['instagramUrl', t.site.instagram],
              ['facebookUrl', t.site.facebook],
              ['airbnbUrl', t.site.airbnb],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="url"
                placeholder="https://"
                value={draft[key] ?? ''}
                // Empty means "no link", which is null in the database, not "".
                onChange={(e) => edit({ [key]: e.target.value.trim() || null })}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        {isDirty && <span className="text-sm text-muted-foreground">{t.content.unsaved}</span>}
        <Button onClick={() => void save()} disabled={!isDirty || isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSaving ? t.common.saving : t.common.save}
        </Button>
      </div>
    </div>
  )
}
