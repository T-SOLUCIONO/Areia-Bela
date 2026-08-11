'use client'

import { Minus, Plus } from 'lucide-react'
import { translations, type Language } from '@/lib/i18n'

export interface GuestCounts {
  adults: number
  children: number
  infants: number
  pets: number
}

interface Props {
  value: GuestCounts
  onChange: (guests: GuestCounts) => void
  maxGuests: number
  /** Opens the "is it a service animal?" explanation. */
  onServiceAnimal: () => void
  language: Language
}

/**
 * Adults, children, infants and pets.
 *
 * Shared by the quoter and the checkout's "change guests" dialog. Capacity is a
 * rule — infants never count towards it, adults never go below one — and a
 * second copy of these steppers would be a second copy of that rule.
 */
export function GuestPicker({ value, onChange, maxGuests, onServiceAnimal, language }: Props) {
  const copy = translations[language].availability

  // Infants are free and uncounted; pets are their own line. Only adults and
  // children fill the house.
  const atCapacity = value.adults + value.children >= maxGuests

  const rows: Array<{
    key: keyof GuestCounts
    title: string
    description: string
    hint?: string
  }> = [
    ...copy.guestRows.map((item, index) => ({
      key: (['adults', 'children', 'infants'] as const)[index],
      title: item.title,
      description: item.description,
    })),
    // Pets belong here rather than in a list of extras: a guest thinks of the
    // dog as part of the party, and the fee follows from the count.
    { key: 'pets' as const, title: copy.petsTitle, description: '', hint: copy.serviceAnimal },
  ]

  const step = (key: keyof GuestCounts, delta: 1 | -1) => {
    const next = Math.max(0, value[key] + delta)
    if (key === 'adults' && next < 1) return
    onChange({ ...value, [key]: next })
  }

  return (
    <div className="space-y-1">
      {rows.map((row, index) => {
        const count = value[row.key]
        const floor = row.key === 'adults' ? 1 : 0
        // Only the two that fill the house are capped.
        const capped = (row.key === 'adults' || row.key === 'children') && atCapacity

        return (
          <div
            key={row.key}
            className={
              index === 0
                ? 'flex items-start justify-between gap-4 py-4'
                : 'flex items-start justify-between gap-4 border-t border-slate-100 py-4'
            }
          >
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-slate-900">{row.title}</p>
              {row.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{row.description}</p>
              )}
              {row.hint && (
                <button
                  type="button"
                  onClick={onServiceAnimal}
                  className="mt-1 cursor-pointer text-left text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900"
                >
                  {row.hint}
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                aria-label={`− ${row.title}`}
                disabled={count <= floor}
                onClick={() => step(row.key, -1)}
                className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-slate-600 transition enabled:hover:border-slate-800 enabled:hover:text-slate-900 disabled:border-slate-200 disabled:text-slate-300"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-5 text-center tabular-nums text-slate-900">{count}</span>
              <button
                type="button"
                aria-label={`+ ${row.title}`}
                disabled={capped}
                onClick={() => step(row.key, 1)}
                className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-slate-600 transition enabled:hover:border-slate-800 enabled:hover:text-slate-900 disabled:border-slate-200 disabled:text-slate-300"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
