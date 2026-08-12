'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

/**
 * The accordion from the reference: one open at a time, a circular button on the
 * right that is filled teal with a minus when open and quiet with a plus when
 * closed.
 *
 * A real `<button>` per row rather than a clickable div, so it is reachable by
 * keyboard and announces its state — the visual is copied, the semantics are not
 * guessed at.
 */
export function FaqList({ faqs }: { faqs: { id: string; question: string; answer: string }[] }) {
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null)

  return (
    <div className="space-y-3">
      {faqs.map((faq) => {
        const isOpen = open === faq.id
        return (
          <div key={faq.id} className="rounded-[20px] bg-card p-5 shadow-sm sm:p-6">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : faq.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <span className="font-serif text-base font-semibold text-foreground sm:text-lg">
                {faq.question}
              </span>
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
                  isOpen
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {isOpen ? (
                  <Minus className="h-4 w-4" aria-hidden />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden />
                )}
              </span>
            </button>
            {isOpen && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
