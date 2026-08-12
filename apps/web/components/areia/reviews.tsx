import { BadgeCheck, Quote, Star } from 'lucide-react'

const RATINGS = [
  { label: 'Limpieza', value: 5.0 },
  { label: 'Comunicación', value: 5.0 },
  { label: 'Ubicación', value: 4.9 },
  { label: 'Valor', value: 4.8 },
]

export interface Review {
  id: string
  authorName: string
  body: string
  stayedAt: string | null
}

/**
 * The rating summary beside the quotes.
 *
 * The four sub-scores are the reference's own figures and stay written here; the
 * quotes come from the CMS. Worth being plain about the seam: those four numbers
 * are not computed from anything in this system, so if the host's real scores ever
 * differ, this block is showing a design and not a fact.
 */
export function Reviews({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
            <BadgeCheck className="size-4" />
            Huéspedes verificados
          </span>
          <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Lo que dicen nuestros huéspedes
          </h2>

          <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-end gap-3">
              <span className="font-display text-5xl font-semibold text-foreground">5.0</span>
              <div className="mb-1">
                <div className="flex gap-0.5 text-accent">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {RATINGS.map(({ label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ocean to-primary"
                      style={{ width: `${(value / 5) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-semibold text-foreground">
                    {value.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {reviews.slice(0, 4).map((review) => (
            <figure
              key={review.id}
              className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-float"
            >
              <Quote className="size-7 text-primary/25" fill="currentColor" />
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground/90">
                {review.body}
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <span className="grid size-10 place-items-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
                  {review.authorName.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{review.authorName}</p>
                  <p className="text-xs text-muted-foreground">
                    Estadía verificada{review.stayedAt ? ` · ${review.stayedAt}` : ''}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
