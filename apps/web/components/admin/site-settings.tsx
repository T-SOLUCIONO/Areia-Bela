'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Switch } from '@areia-bela/ui/switch'
import { Input } from '@areia-bela/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@areia-bela/ui/select'
import { Label } from '@areia-bela/ui/label'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { Textarea } from '@areia-bela/ui/textarea'
import { ApiError } from '@/lib/api-client'
import { fill } from '@areia-bela/shared'
import { cms, type SiteSettings as Settings } from '@/lib/cms-client'
import { useAdminCopy, useAdminCopyRef } from '@/components/admin/admin-language-provider'
import { ImageField } from '@/components/admin/content/image-field'

const BLANK: Settings = {
  airbnbIcalUrl: null,
  contactEmail: '',
  contactPhone: '',
  whatsapp: '',
  seoTitle: '',
  seoDescription: '',
  instagramUrl: null,
  facebookUrl: null,
  airbnbUrl: null,
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  notifyEmail: '',
  notifyWhatsapp: '',
  notifyTelegram: '',
  whatsappProvider: 'TWILIO' as const,
  notifyOnBooking: true,
  notifyOnCancel: true,
  notifyOnChange: true,
  notifyOnMessage: true,
}

/**
 * What the host is told about the WhatsApp template.
 *
 * Split out because the states are not a boolean and reading them inline made
 * the form unreadable. The ordering is deliberate: a configured-but-unknown
 * template is the loudest problem, because it breaks sends that used to work.
 */
function MetaTemplateNotice({
  configured,
  templateStatus,
  copy,
}: {
  configured: boolean
  templateStatus: string | null
  copy: {
    [
      K in
        | 'metaNoTemplate'
        | 'metaTemplateMissing'
        | 'metaTemplatePending'
        | 'metaTemplateRejected'
        | 'metaTemplateOk'
    ]: string
  }
}) {
  // Nothing configured: falls back to free text, which still arrives inside a
  // window the host opened. A limitation, not a breakage.
  if (!configured) return <Warning>{copy.metaNoTemplate}</Warning>

  switch (templateStatus) {
    case 'MISSING':
      return <Warning>{copy.metaTemplateMissing}</Warning>
    case 'PENDING':
    case 'PENDING_DELETION':
    case 'IN_APPEAL':
      return <Warning>{copy.metaTemplatePending}</Warning>
    case 'REJECTED':
    case 'DISABLED':
    case 'PAUSED':
      return <Warning>{copy.metaTemplateRejected}</Warning>
    case 'APPROVED':
      return <p className="text-xs text-muted-foreground">{copy.metaTemplateOk}</p>
    // `null` is "could not ask", which is not news. Anything unrecognised is
    // Meta inventing a status we have not seen, and guessing at it would be
    // worse than staying quiet.
    default:
      return null
  }
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs">
      {children}
    </p>
  )
}

export function SiteSettings() {
  const t = useAdminCopy()
  const copyRef = useAdminCopyRef()
  const [stored, setStored] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Settings | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // Lives on the property row, not on settings, but belongs on this screen: its
  // only job is being the name in the structured data, next to the other two
  // fields the search engines read.
  const [listingName, setListingName] = useState<{ stored: string; draft: string } | null>(null)
  const [status, setStatus] = useState<{
    email: boolean
    whatsapp: boolean
    whatsappConfigured: boolean
    whatsappProvider: 'TWILIO' | 'META'
    twilioConfigured: boolean
    metaConfigured: boolean
    metaProblem: string | null
    metaTemplate: boolean
    metaTemplateStatus: string | null
    telegram: boolean
    telegramConfigured: boolean
  } | null>(null)

  const load = useCallback(async () => {
    try {
      // Null when the row has never been written; the PATCH upserts it.
      const settings = (await cms.settings()) ?? BLANK
      setStored(settings)
      setDraft(settings)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : copyRef.current.content.loadFailed)
    }
  }, [copyRef])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    // Says whether each channel can actually reach anyone, so an address typed
    // here isn't mistaken for a working alert.
    cms.notificationStatus().then(setStatus, () => setStatus(null))
    cms.property().then(
      (property) => setListingName({ stored: property.name, draft: property.name }),
      // Not fatal: the rest of the screen is settings, which loaded on its own.
      () => setListingName(null),
    )
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

  const isDirty =
    JSON.stringify(draft) !== JSON.stringify(stored) ||
    (listingName !== null && listingName.draft !== listingName.stored)
  const edit = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch })

  /**
   * Saves first, then imports.
   *
   * Syncing against a URL still sitting in the form and not in the database
   * would report on a calendar the server has never seen — and the host would
   * read that result as proof the link she just typed works.
   */
  const syncAirbnb = async () => {
    setIsSyncing(true)
    try {
      await cms.saveSettings(draft)
      const result = await cms.syncAirbnb()
      const refreshed = await cms.settings()
      if (refreshed) setDraft(refreshed)
      // The server ran but had no calendar to read: saying nothing here would
      // look exactly like a sync that worked.
      if (!result || 'configured' in result) {
        toast.error(t.content.airbnbNoUrl)
        return
      }
      toast.success(
        fill(t.content.airbnbDone, {
          nights: String(result.nights),
          blocks: String(result.blocks),
        }),
      )
      if (result.collisions.length > 0) {
        toast.warning(fill(t.content.airbnbCollisions, { count: String(result.collisions.length) }))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.content.saveFailed)
    } finally {
      setIsSyncing(false)
    }
  }

  const save = async () => {
    setIsSaving(true)
    try {
      // Two rows behind one button. The name goes first and only when it
      // changed, so an untouched field never sends a write, and a rejection
      // there stops the save instead of reporting a success that was half true.
      if (listingName && listingName.draft !== listingName.stored) {
        const property = await cms.saveProperty({ name: listingName.draft })
        setListingName({ stored: property.name, draft: property.name })
      }
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
          {listingName && (
            <div className="space-y-1.5">
              <Label htmlFor="listing-name">{t.site.listingName}</Label>
              <Input
                id="listing-name"
                value={listingName.draft}
                onChange={(e) => setListingName({ ...listingName, draft: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t.site.listingNameHint}</p>
            </div>
          )}
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

      <section className="space-y-4">
        <div>
          <h3 className="font-serif text-base">{t.site.notifyTitle}</h3>
          <p className="text-sm text-muted-foreground">{t.site.notifySubtitle}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="notifyEmail">{t.site.notifyEmail}</Label>
            <Input
              id="notifyEmail"
              type="email"
              placeholder={draft.contactEmail}
              value={draft.notifyEmail}
              onChange={(e) => edit({ notifyEmail: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {status?.email ? t.site.notifyEmailOn : t.site.notifyEmailOff}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsappProvider">{t.site.whatsappProvider}</Label>
            <Select
              value={draft.whatsappProvider}
              onValueChange={(value) => edit({ whatsappProvider: value as 'TWILIO' | 'META' })}
            >
              <SelectTrigger id="whatsappProvider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TWILIO">{t.site.whatsappProviderTwilio}</SelectItem>
                <SelectItem value="META">{t.site.whatsappProviderMeta}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t.site.whatsappProviderHint}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notifyWhatsapp">{t.site.notifyWhatsapp}</Label>
            <Input
              id="notifyWhatsapp"
              inputMode="numeric"
              placeholder={draft.whatsapp}
              value={draft.notifyWhatsapp}
              onChange={(e) => edit({ notifyWhatsapp: e.target.value.replace(/\D/g, '') })}
            />
            <p className="text-xs text-muted-foreground">
              {status?.whatsappConfigured
                ? t.site.notifyWhatsappOn
                : t.site.whatsappProviderMissing}
            </p>
            {/* Which one is missing matters: the host can pick the other, but
                only a deploy can add credentials. Saying "WhatsApp is off"
                would send them looking in the wrong place. */}
            {/* Meta's own sentence, on its own line rather than glued to a
                translated prefix: it arrives in English whatever language the
                panel is in, and it carries the date the token died. */}
            {draft.whatsappProvider === 'META' && status?.metaProblem && (
              <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
                <p className="text-xs">{t.site.metaRejected}</p>
                <p className="text-xs font-mono text-muted-foreground">{status.metaProblem}</p>
                <p className="text-xs text-muted-foreground">{t.site.metaRejectedFix}</p>
              </div>
            )}
            {/* Three different states that all look identical from the outside:
                no template (falls back to text, works in an open window), a
                template Meta does not know (every send fails), and an approved
                one (arrives always). Only the last is good news. */}
            {draft.whatsappProvider === 'META' && status?.metaConfigured && !status.metaProblem && (
              <MetaTemplateNotice
                configured={status.metaTemplate}
                templateStatus={status.metaTemplateStatus}
                copy={t.site}
              />
            )}
            {status !== null &&
              !status.whatsappConfigured &&
              (draft.whatsappProvider === 'META'
                ? status.twilioConfigured
                : status.metaConfigured) && (
                <p className="text-xs text-muted-foreground">{t.site.whatsappOtherReady}</p>
              )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notifyTelegram">{t.site.notifyTelegram}</Label>
            <Input
              id="notifyTelegram"
              inputMode="numeric"
              value={draft.notifyTelegram}
              // A chat id can be negative — a group's is — so the minus sign
              // survives while everything else that is not a digit does not.
              onChange={(e) => edit({ notifyTelegram: e.target.value.replace(/[^\d-]/g, '') })}
            />
            <p className="text-xs text-muted-foreground">
              {status?.telegramConfigured ? t.site.notifyTelegramOn : t.site.notifyTelegramOff}
            </p>
            <p className="text-xs text-muted-foreground">{t.site.notifyTelegramHint}</p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
          {(
            [
              ['notifyOnBooking', t.site.notifyOnBooking],
              ['notifyOnCancel', t.site.notifyOnCancel],
              ['notifyOnChange', t.site.notifyOnChange],
              ['notifyOnMessage', t.site.notifyOnMessage],
            ] as const
          ).map(([key, label]) => (
            <Label key={key} className="flex items-center gap-2 text-sm font-normal">
              <Switch checked={draft[key]} onCheckedChange={(on) => edit({ [key]: on })} />
              {label}
            </Label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-base">{t.content.logo}</h3>
        {/* Two marks, not one flattened by a filter. The light one is black ink
            on transparency; turning it white in CSS also turns the turquoise
            starfish white. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageField
            label={t.content.logoLight}
            value={draft.logoUrl}
            onChange={(logoUrl) => edit({ logoUrl })}
          />
          <ImageField
            label={t.content.logoDark}
            value={draft.logoDarkUrl}
            onChange={(logoDarkUrl) => edit({ logoDarkUrl })}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t.content.logoHint}</p>

        <div className="pt-2">
          <ImageField
            label={t.content.favicon}
            shape="square"
            value={draft.faviconUrl}
            onChange={(faviconUrl) => edit({ faviconUrl })}
          />
          <p className="mt-2 text-xs text-muted-foreground">{t.content.faviconHint}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-base">{t.content.airbnbTitle}</h3>
        <div className="space-y-1.5">
          <Label htmlFor="airbnbIcalUrl">{t.content.airbnbUrl}</Label>
          <Input
            id="airbnbIcalUrl"
            type="url"
            placeholder="https://www.airbnb.com/calendar/ical/..."
            value={draft.airbnbIcalUrl ?? ''}
            onChange={(e) => edit({ airbnbIcalUrl: e.target.value.trim() || null })}
          />
          <p className="text-xs text-muted-foreground">{t.content.airbnbHint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSyncing || !draft.airbnbIcalUrl}
            onClick={() => void syncAirbnb()}
          >
            {isSyncing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {isSyncing ? t.content.airbnbSyncing : t.content.airbnbSync}
          </Button>

          {/* The state of the last run, not just of this button. A sync that
              quietly stopped working is the failure that matters: the host
              believes the calendar is guarded when it is not. */}
          <span className="text-xs text-muted-foreground">
            {draft.airbnbSyncError ? (
              <span className="text-destructive">
                {t.content.airbnbFailing} · {draft.airbnbSyncError}
              </span>
            ) : draft.airbnbSyncedAt ? (
              `${t.content.airbnbLastSync}: ${new Date(draft.airbnbSyncedAt).toLocaleString()}`
            ) : (
              t.content.airbnbNever
            )}
          </span>
        </div>
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
