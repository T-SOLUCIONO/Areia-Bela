import Image from 'next/image'
import { Coffee, MapPin, Ship, Waves } from 'lucide-react'

const NEARBY = [
  { icon: Waves, title: 'A 5 min de Madeira Beach', desc: 'Arena blanca y aguas del Golfo' },
  {
    icon: Ship,
    title: "John's Pass Village & Boardwalk",
    desc: 'Paseo marítimo, tiendas y mariscos',
  },
  { icon: Coffee, title: 'Restaurantes y cafés locales', desc: 'A distancia de bici o caminando' },
]

export function Location({
  photo,
  city,
  country,
}: {
  photo?: { url: string; alt: string }
  city: string
  country: string
}) {
  return (
    <section id="ubicacion" className="relative overflow-hidden bg-secondary/60 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="relative overflow-hidden rounded-3xl border border-border shadow-float">
            <div className="relative aspect-[4/3]">
              {photo && (
                <Image
                  src={photo.url}
                  alt={photo.alt || `${city}, ${country}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ocean-deep/60 to-transparent" />
            </div>
            <div className="glass absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-soft">
              <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                <MapPin className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{city}, Florida</p>
                <p className="text-xs text-muted-foreground">{country}</p>
              </div>
            </div>
          </div>

          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              Dónde te quedarás
            </span>
            <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Cerca de todo lo que hace especial la costa
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              Un barrio tranquilo y seguro, a minutos de la playa y de los mejores planes de la
              zona.
            </p>

            <ul className="mt-8 space-y-3">
              {NEARBY.map(({ icon: Icon, title, desc }) => (
                <li
                  key={title}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
