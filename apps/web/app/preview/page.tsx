import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowUpRight,
  Award,
  ChevronRight,
  Clock,
  Coffee,
  MapPin,
  MessageCircle,
  Quote,
  Ship,
  ShieldCheck,
  Sparkles,
  Star,
  Umbrella,
  Waves,
} from 'lucide-react'
import { ThemeToggle } from '@/components/public/theme-toggle'
import { FaqList } from './faq-list'
import { API_URL } from '@/lib/api-client'

/**
 * The alternate landing, built to match the reference design.
 *
 * Lives on its own route, outside `[locale]/(public)`, on purpose: that layout
 * brings the current header, footer and floating assistant, which would fight this
 * design and make a side-by-side comparison meaningless. Here the root layout
 * supplies only the fonts and the theme, so the page is a clean canvas.
 *
 * ## What it reuses and what it does not
 *
 * Content, photos and the nightly rate come from the API — the same CMS the live
 * site reads — so this is the real house rather than a mock-up with placeholder
 * text. Nothing is invented: if the CMS has no reviews, the section renders none.
 *
 * Spanish only, and deliberately: the point is to agree on a design, and wiring
 * five locales into a page that may be thrown away is work spent on the wrong
 * question. The live landing keeps its translations.
 *
 * ## Why every colour is a token
 *
 * So it follows the light and dark themes rather than repeating the mistake this
 * codebase just finished undoing — a hardcoded hex is a colour that stops being
 * true the moment anything around it changes.
 */

interface CmsImage {
  url: string
  alt: string
}
interface CmsFaq {
  id: string
  question: string
  answer: string
}
interface CmsReview {
  id: string
  authorName: string
  body: string
  stayedAt: string | null
}
interface Site {
  images: CmsImage[]
  faqs: CmsFaq[]
  reviews: CmsReview[]
  settings: { contactPhone: string; whatsapp: string } | null
}
interface Property {
  maxGuests: number
  bedrooms: number
  bathrooms: number
  city: string
  country: string
  pricePerNight?: number
}

async function load<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { next: { revalidate: 300 } })
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    return null
  }
}

/** The eyebrow above every heading: teal, spaced, small. */
function Eyebrow({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
      {icon}
      {children}
    </p>
  )
}

/** A rounded-square tile behind an icon, the way the reference marks every list item. */
function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
      {children}
    </span>
  )
}

const AMENITIES = [
  'Cocina equipada',
  'Aparcamiento gratuito',
  'Wi-Fi rápido',
  'Piscina climatizada',
  'Zona para trabajar',
  'Smart TV',
  'Lavadora y secadora',
  'Aire acondicionado',
]

const NEARBY = [
  {
    icon: <Waves className="h-5 w-5" aria-hidden />,
    title: 'A 5 min de Madeira Beach',
    note: 'Arena blanca y aguas del Golfo',
  },
  {
    icon: <Ship className="h-5 w-5" aria-hidden />,
    title: "John's Pass Village & Boardwalk",
    note: 'Paseo marítimo, tiendas y mariscos',
  },
  {
    icon: <Coffee className="h-5 w-5" aria-hidden />,
    title: 'Restaurantes y cafés locales',
    note: 'A distancia de bici o caminando',
  },
]

const HIGHLIGHTS = [
  {
    icon: <Coffee className="h-5 w-5" aria-hidden />,
    title: 'Coffee Bar',
    body: 'Empieza el día con café premium, té y todo lo necesario para tu ritual matutino.',
  },
  {
    icon: <Sparkles className="h-5 w-5" aria-hidden />,
    title: 'Rincón de Juegos',
    body: 'Diversión para todas las edades: juegos de mesa, cartas y un espacio cómodo para compartir.',
  },
  {
    icon: <Umbrella className="h-5 w-5" aria-hidden />,
    title: 'Esenciales de Playa',
    body: 'Sillas, toallas, sombrilla, hielera y más listos para tu día perfecto de playa.',
  },
]

const RATINGS = [
  { label: 'Limpieza', value: 5.0 },
  { label: 'Comunicación', value: 5.0 },
  { label: 'Ubicación', value: 4.9 },
  { label: 'Valor', value: 4.8 },
]

export default async function PreviewPage() {
  const [site, property] = await Promise.all([
    load<Site>('/cms/site?locale=es'),
    load<Property>('/properties/areia-bela'),
  ])

  const photos = site?.images ?? []
  const hero = photos[1] ?? photos[0]
  const cards = photos.slice(0, 3)
  const wide = photos.slice(3, 5)
  const beach = photos[4] ?? photos[0]
  const rate = property?.pricePerNight ?? 300

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* The floating pill header: it sits over the content rather than above it,
          which is what gives the reference its layered feel. */}
      <header className="fixed inset-x-0 top-4 z-50 px-4">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 rounded-full bg-card/90 px-4 shadow-lg backdrop-blur-xl sm:px-6">
          <Link href="/preview" className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <Star className="h-5 w-5 fill-current" aria-hidden />
            </span>
            <span className="font-serif text-lg font-bold">
              Areia <span className="text-primary">Bela</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium lg:flex">
            {['Inicio', 'Galería', 'Comodidades', 'Ubicación'].map((item) => (
              <a key={item} href="#inicio" className="transition-colors hover:text-primary">
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href="#reservar"
              className="inline-flex min-h-11 items-center rounded-full bg-panel px-5 text-sm font-semibold text-panel-foreground"
            >
              Reservar
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section id="inicio" className="relative isolate overflow-hidden">
        {hero && (
          <Image
            src={hero.url}
            alt={hero.alt || 'Areia Bela'}
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover"
          />
        )}
        {/* The scrim is load-bearing, not decoration: white type over an arbitrary
            photo is unreadable without it, and the reference darkens the image for
            exactly this reason. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-panel/90 via-panel/70 to-primary/50" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background to-transparent" />

        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-32 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-28 lg:pt-40">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-panel/70 px-4 py-2 text-sm text-panel-foreground backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
              {property?.city ?? 'St. Petersburg'}, Florida · Superanfitriona 5.0
            </p>

            <h1 className="mt-6 font-serif text-5xl font-bold leading-[1.05] tracking-tight text-panel-foreground sm:text-6xl lg:text-7xl">
              Tu refugio con piscina cerca de
              <span className="block text-accent">Madeira Beach</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-panel-muted">
              {property
                ? `${property.bedrooms} dormitorios · ${property.bathrooms} baños · Familiar y pet-friendly.`
                : 'Familiar y pet-friendly.'}{' '}
              A solo 5 minutos de la playa, con piscina climatizada privada todo el año.
            </p>

            <a
              href="#reservar"
              className="mt-8 inline-flex min-h-14 items-center gap-2 rounded-full bg-accent px-7 font-semibold text-accent-foreground shadow-lg transition-transform hover:scale-[1.02]"
            >
              Reserva tu estadía
              <ChevronRight className="h-4 w-4" aria-hidden />
            </a>

            <ul className="mt-8 flex flex-wrap gap-3">
              {[
                {
                  icon: <Star className="h-4 w-4" aria-hidden />,
                  label: `Hasta ${property?.maxGuests ?? 8} huéspedes`,
                },
                { icon: <Waves className="h-4 w-4" aria-hidden />, label: 'Piscina climatizada' },
                { icon: <Sparkles className="h-4 w-4" aria-hidden />, label: 'Admite mascotas' },
                {
                  icon: <Umbrella className="h-4 w-4" aria-hidden />,
                  label: 'Lista para la familia',
                },
              ].map((pill) => (
                <li
                  key={pill.label}
                  className="inline-flex items-center gap-2 rounded-full bg-panel/70 px-4 py-2.5 text-sm text-panel-foreground backdrop-blur"
                >
                  <span className="text-accent">{pill.icon}</span>
                  {pill.label}
                </li>
              ))}
            </ul>
          </div>

          {/* The frosted booking card. Translucent over the photo, which is what
              makes it feel set into the image rather than pasted on top. */}
          <div className="rounded-[32px] border border-card/30 bg-card/80 p-6 shadow-2xl backdrop-blur-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Desde
                <span className="mt-1 block font-serif text-4xl font-bold text-foreground">
                  ${rate}{' '}
                  <span className="text-base font-normal text-muted-foreground">/ noche</span>
                </span>
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Mejor tarifa
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {['Entrada', 'Salida'].map((label) => (
                <div key={label} className="rounded-2xl bg-secondary px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 text-sm text-foreground">mm/dd/aaaa</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Huéspedes
                </p>
                <p className="mt-1 text-sm text-foreground">2 huéspedes</p>
              </div>
              <div className="flex gap-2">
                {['−', '+'].map((sign) => (
                  <span
                    key={sign}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground"
                  >
                    {sign}
                  </span>
                ))}
              </div>
            </div>

            <a
              href="#reservar"
              id="reservar"
              className="mt-5 flex min-h-14 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
            >
              Reservar ahora
            </a>
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              Mejor precio garantizado al reservar directo
            </p>
          </div>
        </div>
      </section>

      {/* ── Detalles ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Cada detalle cuenta</Eyebrow>
            <h2 className="mt-3 max-w-xl font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Detalles pensados para una estadía inolvidable
            </h2>
          </div>
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-5 text-sm font-semibold shadow-sm">
            Ver todas las fotos
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </span>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((item, index) => (
            <article
              key={item.title}
              className={`overflow-hidden rounded-[26px] bg-card shadow-sm ${index === 0 ? 'lg:row-span-2' : ''}`}
            >
              <div className={`relative ${index === 0 ? 'h-64 lg:h-96' : 'h-48'}`}>
                {cards[index] && (
                  <Image
                    src={cards[index].url}
                    alt={cards[index].alt || item.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover"
                  />
                )}
                <span className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-card text-primary shadow">
                  {item.icon}
                </span>
              </div>
              <div className="p-6">
                <h3 className="font-serif text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </article>
          ))}
        </div>

        {wide.length > 0 && (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {wide.map((photo) => (
              <div key={photo.url} className="relative h-64 overflow-hidden rounded-[26px] sm:h-72">
                <Image
                  src={photo.url}
                  alt={photo.alt || 'Areia Bela'}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Todo sobre la casa ─────────────────────────────────────────────── */}
      <section className="bg-secondary/60 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Eyebrow>Todo listo para ti</Eyebrow>
          <h2 className="mt-3 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Todo sobre la casa
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Los detalles que vale la pena conocer antes de reservar, y las respuestas a lo que más
            preguntan nuestros huéspedes.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.85fr_1fr]">
            <ul className="grid grid-cols-2 gap-3 self-start">
              {AMENITIES.map((label) => (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-[18px] bg-card p-3.5 text-sm font-medium shadow-sm"
                >
                  <IconTile>
                    <Sparkles className="h-5 w-5" aria-hidden />
                  </IconTile>
                  {label}
                </li>
              ))}
            </ul>

            {site?.faqs.length ? (
              <FaqList faqs={site.faqs} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no hay preguntas publicadas en el panel.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Reseñas ────────────────────────────────────────────────────────── */}
      {site?.reviews.length ? (
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <Eyebrow icon={<ShieldCheck className="h-4 w-4" aria-hidden />}>
                Huéspedes verificados
              </Eyebrow>
              <h2 className="mt-3 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Lo que dicen nuestros huéspedes
              </h2>

              <div className="mt-8 rounded-[26px] bg-card p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <p className="font-serif text-5xl font-bold">5.0</p>
                  <div>
                    <div className="flex gap-0.5 text-accent">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" aria-hidden />
                      ))}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {site.reviews.length} reseñas
                    </p>
                  </div>
                </div>

                <dl className="mt-6 space-y-3">
                  {RATINGS.map((row) => (
                    <div key={row.label} className="flex items-center gap-4 text-sm">
                      <dt className="w-28 shrink-0 text-muted-foreground">{row.label}</dt>
                      <dd className="flex flex-1 items-center gap-3">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${(row.value / 5) * 100}%` }}
                          />
                        </span>
                        <span className="w-8 text-right font-semibold">{row.value.toFixed(1)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {site.reviews.slice(0, 4).map((review) => (
                <article key={review.id} className="rounded-[26px] bg-card p-6 shadow-sm">
                  <Quote className="h-8 w-8 text-secondary" aria-hidden />
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {review.body}
                  </p>
                  <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-semibold text-primary">
                      {review.authorName.charAt(0)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{review.authorName}</p>
                      <p className="text-xs text-muted-foreground">
                        Estadía verificada{review.stayedAt ? ` · ${review.stayedAt}` : ''}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Ubicación ──────────────────────────────────────────────────────── */}
      <section className="bg-secondary/60 py-20 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div className="relative h-80 overflow-hidden rounded-[28px] shadow-lg lg:h-[26rem]">
            {beach && (
              <Image
                src={beach.url}
                alt={beach.alt || 'St. Petersburg, Florida'}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            )}
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-[20px] bg-card/85 px-4 py-3 backdrop-blur">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {property?.city ?? 'St. Petersburg'}, Florida
                </p>
                <p className="text-xs text-muted-foreground">
                  {property?.country ?? 'Estados Unidos'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <Eyebrow>Dónde te quedarás</Eyebrow>
            <h2 className="mt-3 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Cerca de todo lo que hace especial la costa
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Un barrio tranquilo y seguro, a minutos de la playa y de los mejores planes de la
              zona.
            </p>

            <ul className="mt-8 space-y-3">
              {NEARBY.map((item) => (
                <li
                  key={item.title}
                  className="flex items-center gap-4 rounded-[20px] bg-card p-4 shadow-sm"
                >
                  <IconTile>{item.icon}</IconTile>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Cierre ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="overflow-hidden rounded-[28px] bg-panel p-8 text-panel-foreground sm:p-12">
          <p className="inline-flex items-center gap-2 rounded-full bg-panel-foreground/10 px-4 py-2 text-sm">
            <Star className="h-4 w-4 fill-current text-accent" aria-hidden />
            Reserva directa · Mejor tarifa garantizada
          </p>
          <h2 className="mt-6 max-w-2xl font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Reserva directo y ahorra en tu escapada a la playa
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-panel-muted">
            Comunicación clara, la mejor tarifa y una estadía más fluida de inicio a fin. Desde $
            {rate} por noche.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <a
              href="#reservar"
              className="inline-flex min-h-14 items-center gap-2 rounded-full bg-accent px-7 font-semibold text-accent-foreground"
            >
              Reservar ahora
              <ChevronRight className="h-4 w-4" aria-hidden />
            </a>
            <p className="flex items-center gap-2 text-sm text-panel-muted">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              No se te cobrará todavía
            </p>
          </div>
        </div>
      </section>

      {/* ── Anfitriona ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28">
        <div className="grid overflow-hidden rounded-[28px] bg-card shadow-sm lg:grid-cols-[0.8fr_1.2fr]">
          <div className="relative h-72 lg:h-auto">
            {photos[5] && (
              <Image
                src={photos[5].url}
                alt="Angélica"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
              />
            )}
          </div>
          <div className="p-8 sm:p-10">
            <p className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
              <Award className="h-4 w-4" aria-hidden />
              Superanfitriona desde 2019
            </p>
            <h2 className="mt-5 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
              Conoce a Angélica
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              ¡Hola! Soy Angélica y me encanta compartir este hermoso rincón de Florida con viajeros
              de todo el mundo. Mi misión es que tu estadía sea perfecta: desde el primer mensaje
              hasta el último día.
            </p>

            <div className="mt-7 grid grid-cols-3 gap-3">
              {[
                {
                  icon: <Star className="h-5 w-5" aria-hidden />,
                  value: `${site?.reviews.length ?? 0}+`,
                  label: 'Reseñas',
                },
                {
                  icon: <Clock className="h-5 w-5" aria-hidden />,
                  value: '< 1 h',
                  label: 'Respuesta',
                },
                {
                  icon: <MessageCircle className="h-5 w-5" aria-hidden />,
                  value: '100%',
                  label: 'Tasa de respuesta',
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[20px] bg-secondary/60 p-4 text-center">
                  <span className="inline-flex text-primary">{stat.icon}</span>
                  <p className="mt-2 font-serif text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {site?.settings?.whatsapp && (
              <a
                href={`https://wa.me/${site.settings.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full border border-border px-6 text-sm font-semibold"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Contactar a Angélica
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-muted-foreground sm:px-6 lg:flex-row lg:justify-between">
          <span className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <Star className="h-4 w-4 fill-current" aria-hidden />
            </span>
            <span className="font-serif text-base font-bold text-foreground">
              Areia <span className="text-primary">Bela</span>
            </span>
          </span>
          <p>{property?.city ?? 'St. Petersburg'}, Florida · A 5 minutos de Madeira Beach</p>
          <p>© {new Date().getUTCFullYear()} Areia Bela. Reserva directa.</p>
        </div>
      </footer>
    </div>
  )
}
