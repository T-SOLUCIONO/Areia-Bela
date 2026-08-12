import Image from 'next/image'
import { ArrowUpRight, Coffee, Dices, Umbrella } from 'lucide-react'

const DETAILS = [
  {
    icon: Coffee,
    title: 'Coffee Bar',
    desc: 'Empieza el día con café premium, té y todo lo necesario para tu ritual matutino.',
  },
  {
    icon: Dices,
    title: 'Rincón de Juegos',
    desc: 'Diversión para todas las edades: juegos de mesa, cartas y un espacio cómodo para compartir.',
  },
  {
    icon: Umbrella,
    title: 'Esenciales de Playa',
    desc: 'Sillas, toallas, sombrilla, hielera y más listos para tu día perfecto de playa.',
  },
]

/**
 * The gallery: three cards where the first is twice as tall, then two wide ones.
 *
 * Photos arrive as props from the CMS instead of being written in. The reference
 * hardcodes `/images/coffee-bar.png` and friends; here the host reorders photos in
 * the panel and the page follows.
 */
export function Gallery({ photos }: { photos: { url: string; alt: string }[] }) {
  const cards = photos.slice(0, 3)
  const strip = photos.slice(3, 5)

  return (
    <section id="galeria" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            Cada detalle cuenta
          </span>
          <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Detalles pensados para una estadía inolvidable
          </h2>
        </div>
        <a
          href="#galeria"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary hover:text-primary"
        >
          Ver todas las fotos
          <ArrowUpRight className="size-4" />
        </a>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {DETAILS.map(({ icon: Icon, title, desc }, i) => (
          <article
            key={title}
            className={`group relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-float ${
              i === 0 ? 'lg:row-span-2' : ''
            }`}
          >
            <div
              className={`relative w-full overflow-hidden ${i === 0 ? 'aspect-[4/5]' : 'aspect-[16/10]'}`}
            >
              {cards[i] && (
                <Image
                  src={cards[i].url}
                  alt={cards[i].alt || title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ocean-deep/70 via-transparent to-transparent" />
              <span className="glass absolute left-4 top-4 grid size-11 place-items-center rounded-2xl text-primary shadow-soft">
                <Icon className="size-5" strokeWidth={2} />
              </span>
            </div>
            <div className="p-6">
              <h3 className="font-display text-xl font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          </article>
        ))}
      </div>

      {strip.length > 0 && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {strip.map((photo) => (
            <div
              key={photo.url}
              className="group relative aspect-[16/9] overflow-hidden rounded-3xl border border-border shadow-soft"
            >
              <Image
                src={photo.url}
                alt={photo.alt || 'Areia Bela'}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
