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
import { cms, type PropertySettings as Property } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { cn } from '@/lib/utils'

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

/**
 * The house itself: capacity, fees, times. This is the endpoint whose absence
 * got the old "General / Booking" tabs deleted — they were 26 inputs behind a
 * button that saved nothing. Every field here reaches the database.
 *
 * The fee fields feed the server-side quote, so a typo changes what guests are
 * charged. That's why saving is explicit rather than on-blur.
 */
export function PropertySettings() {
  const t = useAdminCopy()
  const [stored, setStored] = useState<Property | null>(null)
  const [draft, setDraft] = useState<Property | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const property = await cms.property()
      setStored(property)
      setDraft(property)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.property.loadFailed)
    }
  }, [t.property.loadFailed])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (!draft || !stored) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(stored)
  const edit = (patch: Partial<Property>) => setDraft({ ...draft, ...patch })

  const toggleDay = (day: string) => {
    const days = draft.trashCollectionDays.includes(day)
      ? draft.trashCollectionDays.filter((d) => d !== day)
      : [...draft.trashCollectionDays, day]
    // Keep calendar order regardless of the order they were clicked.
    edit({ trashCollectionDays: WEEKDAYS.filter((d) => days.includes(d)) })
  }

  const save = async () => {
    setIsSaving(true)
    try {
      const saved = await cms.saveProperty({
        name: draft.name,
        description: draft.description,
        maxGuests: draft.maxGuests,
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        // Decimals come back as strings; the API validates them as numbers.
        additionalGuestFeePerNight: Number(draft.additionalGuestFeePerNight),
        cleaningFee: Number(draft.cleaningFee),
        serviceFeePercent: Number(draft.serviceFeePercent),
        taxesPercent: Number(draft.taxesPercent),
        address: draft.address,
        city: draft.city,
        state: draft.state,
        country: draft.country,
        checkInTime: draft.checkInTime,
        checkOutTime: draft.checkOutTime,
        trashCollectionDays: draft.trashCollectionDays,
      })
      setStored(saved)
      setDraft(saved)
      toast.success(t.property.saved)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.property.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const field = (
    id: string,
    label: string,
    value: string | number,
    onChange: (value: string) => void,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </div>
  )

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        {field('name', t.property.nameLabel, draft.name, (name) => edit({ name }))}
        <div className="space-y-1.5">
          <Label htmlFor="description">{t.property.descriptionLabel}</Label>
          <Textarea
            id="description"
            rows={4}
            value={draft.description}
            onChange={(e) => edit({ description: e.target.value })}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="grid gap-4 sm:grid-cols-3">
          {field(
            'max-guests',
            t.property.maxGuests,
            draft.maxGuests,
            (v) => edit({ maxGuests: Number(v) || 0 }),
            { type: 'number', min: 1 },
          )}
          {field(
            'bedrooms',
            t.property.bedrooms,
            draft.bedrooms,
            (v) => edit({ bedrooms: Number(v) || 0 }),
            { type: 'number', min: 0 },
          )}
          {field(
            'bathrooms',
            t.property.bathrooms,
            draft.bathrooms,
            (v) => edit({ bathrooms: Number(v) || 0 }),
            { type: 'number', min: 0 },
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t.property.capacityNote}</p>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-serif text-base">{t.property.feesTitle}</h3>
          <p className="text-sm text-muted-foreground">{t.property.feesSubtitle}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {field(
            'cleaning-fee',
            t.property.cleaningFee,
            draft.cleaningFee,
            (cleaningFee) => edit({ cleaningFee }),
            { type: 'number', min: 0, step: '0.01' },
          )}
          {field(
            'guest-fee',
            t.property.additionalGuestFee,
            draft.additionalGuestFeePerNight,
            (additionalGuestFeePerNight) => edit({ additionalGuestFeePerNight }),
            { type: 'number', min: 0, step: '0.01' },
          )}
          {field(
            'service-fee',
            t.property.serviceFeePercent,
            draft.serviceFeePercent,
            (serviceFeePercent) => edit({ serviceFeePercent }),
            { type: 'number', min: 0, step: '0.01' },
          )}
          {field(
            'taxes',
            t.property.taxesPercent,
            draft.taxesPercent,
            (taxesPercent) => edit({ taxesPercent }),
            { type: 'number', min: 0, step: '0.01' },
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-base">{t.property.stayTitle}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            'check-in',
            t.property.checkInTime,
            draft.checkInTime,
            (checkInTime) => edit({ checkInTime }),
            { type: 'time' },
          )}
          {field(
            'check-out',
            t.property.checkOutTime,
            draft.checkOutTime,
            (checkOutTime) => edit({ checkOutTime }),
            { type: 'time' },
          )}
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t.property.trashDays}</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const selected = draft.trashCollectionDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={selected}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm capitalize transition-colors',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  )}
                >
                  {new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(
                    // 2024-01-01 was a Monday, so index 0 lands on Monday.
                    new Date(Date.UTC(2024, 0, 1 + WEEKDAYS.indexOf(day))),
                  )}
                </button>
              )
            })}
          </div>
        </fieldset>
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-base">{t.property.addressTitle}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {field('address', t.property.address, draft.address, (address) => edit({ address }))}
          {field('city', t.property.city, draft.city, (city) => edit({ city }))}
          {field('state', t.property.state, draft.state, (state) => edit({ state }))}
          {field('country', t.property.country, draft.country, (country) => edit({ country }))}
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
