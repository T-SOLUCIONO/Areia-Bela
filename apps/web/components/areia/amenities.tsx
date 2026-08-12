'use client'

import { useState } from 'react'
import {
  Car,
  ChefHat,
  Flame,
  Laptop,
  Minus,
  Plus,
  ShieldAlert,
  Tv,
  WashingMachine,
  Waves,
  Wifi,
  Wind,
} from 'lucide-react'

const AMENITIES = [
  { icon: ChefHat, label: 'Cocina equipada' },
  { icon: Car, label: 'Aparcamiento gratuito' },
  { icon: Wifi, label: 'Wi-Fi rápido' },
  { icon: Waves, label: 'Piscina climatizada' },
  { icon: Laptop, label: 'Zona para trabajar' },
  { icon: Tv, label: 'Smart TV' },
  { icon: WashingMachine, label: 'Lavadora y secadora' },
  { icon: Wind, label: 'Aire acondicionado' },
  { icon: Flame, label: 'Calefacción' },
  { icon: ShieldAlert, label: 'Detectores de seguridad' },
]

export interface Faq {
  id: string
  question: string
  answer: string
}

function FaqItem({ faq, open, onToggle }: { faq: Faq; open: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-display text-base font-semibold text-foreground">{faq.question}</span>
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
            open ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
          }`}
        >
          {open ? <Minus className="size-4" /> : <Plus className="size-4" />}
        </span>
      </button>
      {/* Animated with grid rows rather than height, so the panel can open to
          whatever the answer needs without a magic pixel value. */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Amenities beside the questions.
 *
 * The amenity list is written here and the questions come from the CMS, which is
 * not an inconsistency: the list is a fixed set of icons the design depends on,
 * while the answers are the host's words and change without a deploy.
 */
export function Amenities({ faqs }: { faqs: Faq[] }) {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null)

  return (
    <section id="comodidades" className="relative overflow-hidden bg-secondary/60 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            Todo listo para ti
          </span>
          <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Todo sobre la casa
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Los detalles que vale la pena conocer antes de reservar, y las respuestas a lo que más
            preguntan nuestros huéspedes.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid grid-cols-2 gap-3 self-start">
            {AMENITIES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" strokeWidth={2} />
                </span>
                <span className="text-sm font-medium leading-tight text-foreground">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {faqs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay preguntas publicadas en el panel.
              </p>
            ) : (
              faqs.map((faq) => (
                <FaqItem
                  key={faq.id}
                  faq={faq}
                  open={openId === faq.id}
                  onToggle={() => setOpenId(openId === faq.id ? null : faq.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
