import Image from 'next/image'
import { Award, Clock, MessageCircle, Star } from 'lucide-react'

export function Host({
  photo,
  reviewCount,
  whatsapp,
}: {
  photo?: { url: string; alt: string }
  reviewCount: number
  whatsapp: string | null
}) {
  const stats = [
    { icon: Star, label: 'Reseñas', value: `${reviewCount}+` },
    { icon: Clock, label: 'Respuesta', value: '< 1 h' },
    { icon: MessageCircle, label: 'Tasa de respuesta', value: '100%' },
  ]

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-float">
        <div className="grid gap-0 md:grid-cols-[0.8fr_1.2fr]">
          <div className="relative min-h-72 md:min-h-full">
            {photo && (
              <Image
                src={photo.url}
                alt={photo.alt || 'Angélica, anfitriona de Areia Bela'}
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className="object-cover"
              />
            )}
          </div>

          <div className="p-8 sm:p-10 lg:p-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-sand-foreground">
              <Award className="size-3.5" />
              Superanfitriona desde 2019
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Conoce a Angélica
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              ¡Hola! Soy Angélica y me encanta compartir este hermoso rincón de Florida con viajeros
              de todo el mundo. Mi misión es que tu estadía sea perfecta: desde el primer mensaje
              hasta el último día.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {stats.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-background/60 p-4 text-center"
                >
                  <Icon className="mx-auto size-5 text-primary" />
                  <p className="mt-2 font-display text-xl font-semibold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* Only rendered when there is a number to reach. A contact button that
                goes nowhere is worse than no button. */}
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary hover:text-primary"
              >
                <MessageCircle className="size-4" />
                Contactar a Angélica
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
