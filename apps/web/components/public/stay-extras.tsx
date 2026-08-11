'use client'

import { useEffect, useState } from 'react'
import { format, parse } from 'date-fns'
import { de, enUS, es, fr, ptBR } from 'date-fns/locale'
import { Baby, Check, Minus, Plus, Waves } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { extraAvailableOn, fill, nightsOf } from '@areia-bela/shared'
import { currency } from '@/lib/booking'
import { PROPERTY_SLUG } from '@/lib/property-data'
import { API_URL } from '@/lib/api-client'
import { translations } from '@/lib/i18n'
import type { Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface Extra {
  id: string
  key: string
  name: string
  price: string
  pricingType: 'PER_NIGHT' | 'PER_HOUR' | 'PER_STAY'
  active: boolean
  seasonStartMonthDay: string | null
  seasonEndMonthDay: string | null
}

interface Props {
  checkIn: string
  checkOut: string
  /**
   * Units per extra, keyed by the extra's `key` — not its cuid.
   *
   * The API returns both, and the pricing input renames `key` to `id`, so a
   * quote sent with the cuid silently prices every extra at zero. Nothing
   * errors; the line just never appears.
   */
  selected: Record<string, number>
  onChange: (selected: Record<string, number>) => void
  language: Language
  className?: string
}

/**
 * Extras the guest can actually buy, which until now none of them could.
 *
 * The heated pool and the nanny have been priced correctly by the engine since
 * Fase 3 — season, hourly units and all — but nothing on the site ever put
 * their ids in a quote. They were charges with no way to incur them.
 *
 * Two are deliberately not here: the pet fee lives in the guest picker, where
 * a guest thinks about the dog, and the additional-guest fee is charged
 * automatically from the party size.
 */
const HIDDEN_KEYS = new Set(['pet', 'additional-guest'])

const ICONS: Record<string, typeof Waves> = {
  'heated-pool': Waves,
  'certified-nanny': Baby,
}

const DATE_LOCALES = { es, en: enUS, pt: ptBR, fr, de }

/** The same record without one key. Reads better than destructuring to omit. */
function without(record: Record<string, number>, key: string): Record<string, number> {
  return Object.fromEntries(Object.entries(record).filter(([id]) => id !== key))
}

export function StayExtras({ checkIn, checkOut, selected, onChange, language, className }: Props) {
  const copy = translations[language].stayExtras
  const locale = DATE_LOCALES[language]

  const [extras, setExtras] = useState<Extra[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch(`${API_URL}/properties/${PROPERTY_SLUG}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((property: { extras?: Extra[] } | null) => {
        if (cancelled) return
        setExtras(
          (property?.extras ?? []).filter((extra) => extra.active && !HIDDEN_KEYS.has(extra.key)),
        )
      })
      .catch(() => {
        // Fail-soft: the stay is still bookable without extras.
        if (!cancelled) setExtras([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!extras?.length) return null

  const nights = nightsOf(checkIn, checkOut)

  /** "10-01" → "1 Oct", in the guest's language. */
  const monthDay = (value: string) => format(parse(value, 'MM-dd', new Date()), 'd MMM', { locale })

  const unitLabel = (extra: Extra) =>
    extra.pricingType === 'PER_NIGHT'
      ? copy.perNight
      : extra.pricingType === 'PER_HOUR'
        ? copy.perHour
        : copy.perStay

  return (
    <section className={cn('space-y-4', className)}>
      <div>
        <h2 className="font-serif text-xl text-foreground">{copy.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.lead}</p>
      </div>

      <ul className="space-y-3">
        {extras.map((extra) => {
          const Icon = ICONS[extra.key] ?? Waves
          const price = Number(extra.price)
          const units = selected[extra.key] ?? 0
          const taken = units > 0

          // A seasonal extra covers only the nights it is offered on, so the
          // engine bills part of a stay that straddles the season boundary.
          // Saying which nights beats a price the guest cannot reconcile.
          const covered =
            extra.pricingType === 'PER_NIGHT'
              ? nights.filter((night) =>
                  extraAvailableOn(
                    {
                      id: extra.key,
                      label: extra.name,
                      price,
                      pricingType: extra.pricingType,
                      seasonStartMonthDay: extra.seasonStartMonthDay,
                      seasonEndMonthDay: extra.seasonEndMonthDay,
                    },
                    night,
                  ),
                ).length
              : null
          const outOfSeason = covered === 0

          return (
            <li
              key={extra.id}
              className={cn(
                'flex flex-col gap-3 rounded-[16px] border p-4 sm:flex-row sm:items-center sm:justify-between',
                taken ? 'border-primary bg-primary/5' : 'border-border',
                outOfSeason && 'opacity-60',
              )}
            >
              <div className="flex min-w-0 items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{extra.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {currency(price)} {unitLabel(extra)}
                  </p>

                  {extra.seasonStartMonthDay && extra.seasonEndMonthDay && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {outOfSeason
                        ? copy.outOfSeason
                        : fill(copy.seasonOnly, {
                            from: monthDay(extra.seasonStartMonthDay),
                            to: monthDay(extra.seasonEndMonthDay),
                          })}
                    </p>
                  )}

                  {taken && covered !== null && covered > 0 && (
                    <p className="mt-0.5 text-xs text-primary">
                      {fill(copy.nightsCovered, { count: String(covered) })}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                {extra.pricingType === 'PER_HOUR' && taken ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{copy.hours}</span>
                    <Stepper
                      value={units}
                      onChange={(next) => {
                        const rest = without(selected, extra.key)
                        onChange(next > 0 ? { ...rest, [extra.key]: next } : rest)
                      }}
                    />
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant={taken ? 'outline' : 'brand'}
                    size="sm"
                    disabled={outOfSeason}
                    onClick={() => {
                      const rest = without(selected, extra.key)
                      onChange(taken ? rest : { ...rest, [extra.key]: 1 })
                    }}
                  >
                    {taken ? (
                      <>
                        <Check className="h-4 w-4" />
                        {copy.remove}
                      </>
                    ) : (
                      copy.add
                    )}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="-"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-slate-800 hover:text-foreground"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="+"
        onClick={() => onChange(value + 1)}
        className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-slate-800 hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
