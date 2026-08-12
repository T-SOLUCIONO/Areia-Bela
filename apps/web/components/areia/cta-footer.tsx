import Image from 'next/image'
import { ChevronRight, ShieldCheck, Star } from 'lucide-react'

export function CtaFooter({
  photo,
  rate,
  city,
}: {
  photo?: { url: string; alt: string }
  rate: number
  city: string
}) {
  return (
    <>
      <section id="reservar" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-ocean-deep p-8 shadow-float sm:p-12 lg:p-16">
          {photo && (
            <div className="absolute inset-0 opacity-30">
              <Image
                src={photo.url}
                alt=""
                aria-hidden
                fill
                sizes="100vw"
                className="object-cover"
              />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-ocean-deep via-ocean-deep/90 to-ocean-deep/60" />

          {/* `text-white` rather than `text-background`: this panel is navy in both
              themes, so a token that flips would take the text with it. */}
          <div className="relative z-10 max-w-xl text-white">
            <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium">
              <Star className="size-3.5 fill-current text-accent" />
              Reserva directa · Mejor tarifa garantizada
            </span>
            <h2 className="mt-5 text-balance font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Reserva directo y ahorra en tu escapada a la playa
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-white/80">
              Comunicación clara, la mejor tarifa y una estadía más fluida de inicio a fin. Desde $
              {rate} por noche.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#inicio"
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-float transition-all hover:-translate-y-0.5"
              >
                Reservar ahora
                <ChevronRight className="size-4" />
              </a>
              <span className="inline-flex items-center gap-2 text-sm text-white/80">
                <ShieldCheck className="size-4 text-accent" />
                No se te cobrará todavía
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Star className="size-5 fill-current" strokeWidth={1.5} />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">
              Areia <span className="text-primary">Bela</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {city}, Florida · A 5 minutos de Madeira Beach
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getUTCFullYear()} Areia Bela. Reserva directa.
          </p>
        </div>
      </footer>
    </>
  )
}
