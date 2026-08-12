'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ChevronRight, Dog, ShieldCheck, Sparkles, Users, Waves, Wifi } from 'lucide-react'

const BADGES = [
  { icon: Users, label: 'Hasta 8 huéspedes' },
  { icon: Waves, label: 'Piscina climatizada' },
  { icon: Dog, label: 'Admite mascotas' },
  { icon: Sparkles, label: 'Lista para la familia' },
  { icon: Wifi, label: 'Wi-Fi rápido' },
]

/**
 * The hero: photo, scrim, headline, and the booking card in frosted glass.
 *
 * `maxGuests` and `rate` are passed in rather than written here, because they are
 * facts the panel owns. A nightly rate typed into a component is a number that
 * goes stale silently — and this project's rule is that the server owns pricing.
 */
export function Hero({
  photo,
  rate,
  maxGuests,
  bedrooms,
  bathrooms,
}: {
  photo?: { url: string; alt: string }
  rate: number
  maxGuests: number
  bedrooms: number
  bathrooms: number
}) {
  const [guests, setGuests] = useState(2)

  return (
    <section id="inicio" className="relative overflow-hidden pt-24 sm:pt-28">
      <div className="absolute inset-0 z-0">
        {photo && (
          <Image
            src={photo.url}
            alt={photo.alt || 'Piscina climatizada privada de Areia Bela'}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        {/* Two scrims, not one. The horizontal pass darkens the side the type sits
            on; the vertical pass melts the photo into the page so the section has
            no seam. Without them white text over an arbitrary photo is a gamble. */}
        <div className="absolute inset-0 bg-gradient-to-r from-ocean-deep/90 via-ocean-deep/65 to-ocean-deep/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-24">
        <div className="animate-rise text-white">
          <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-white/90">
            <span className="size-1.5 rounded-full bg-accent" />
            St. Petersburg, Florida · Superanfitriona 5.0
          </span>

          <h1 className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Tu refugio con piscina cerca de{' '}
            <span className="bg-gradient-to-r from-accent to-sand bg-clip-text text-transparent">
              Madeira Beach
            </span>
          </h1>

          <p className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-white/85 sm:text-lg">
            {bedrooms} dormitorios · {bathrooms} baños · Familiar y pet-friendly. A solo 5 minutos
            de la playa, con piscina climatizada privada todo el año.
          </p>

          <a
            href="#reservar"
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-float transition-all hover:-translate-y-0.5"
          >
            Reserva tu estadía
            <ChevronRight className="size-4" />
          </a>

          <ul className="mt-9 flex flex-wrap gap-2.5">
            {BADGES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="glass-dark inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-white/90"
              >
                <Icon className="size-4 text-accent" strokeWidth={2} />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-rise [animation-delay:120ms]">
          <div className="glass rounded-3xl p-5 shadow-float sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Desde</p>
                <p className="font-display text-3xl font-semibold text-foreground">
                  ${rate}{' '}
                  <span className="text-base font-normal text-muted-foreground">/ noche</span>
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-sand-foreground">
                <Sparkles className="size-3.5" />
                Mejor tarifa
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-border">
              {(['Entrada', 'Salida'] as const).map((label, index) => (
                <label
                  key={label}
                  className={index === 0 ? 'border-r border-border p-3.5' : 'p-3.5'}
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <input
                    type="date"
                    aria-label={label}
                    className="mt-1 w-full bg-transparent text-sm text-foreground outline-none"
                  />
                </label>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-border p-3.5">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Huéspedes
                </span>
                <span className="text-sm font-medium text-foreground">
                  {guests} {guests === 1 ? 'huésped' : 'huéspedes'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  className="grid size-11 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary"
                  aria-label="Quitar huésped"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.min(maxGuests, g + 1))}
                  className="grid size-11 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary"
                  aria-label="Añadir huésped"
                >
                  +
                </button>
              </div>
            </div>

            <a
              href="#reservar"
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:-translate-y-0.5"
            >
              Reservar ahora
            </a>

            <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              Mejor precio garantizado al reservar directo
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
