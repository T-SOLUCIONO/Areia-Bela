'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { AvailabilityCard } from '@/components/public/availability-card'
import { ContentIcon } from '@/lib/content-icons'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/components/language-provider'
import { useSiteContent } from '@/components/public/site-content-provider'
import { itemsOf } from '@/lib/cms-public'
import { translations } from '@/lib/i18n'
import { propertyData } from '@/lib/property-data'

type HeroProps = {
  images: string[]
}

export function HomeHero({ images }: HeroProps) {
  const [index, setIndex] = useState(0)
  const total = images.length
  const { language } = useLanguage()
  const copy = translations[language]

  // Everything below comes from /admin/content; the bundled copy is the
  // fallback for a cold or offline API.
  const section = useSiteContent()?.sections.HERO
  const badges = itemsOf(section, 'HERO_BADGE')
  const title = section ? section.title : ''
  const subtitle = section ? section.subtitle : ''
  const subline = section ? section.body : ''
  const ctaLabel = section ? section.ctaLabel : ''
  /**
   * The line above the headline: where the house is and who keeps it.
   *
   * Composed from facts rather than written here — the city and the rating come
   * from the listing, the word "Superhost" from the locale — and only when they
   * exist. The host can override the whole line from /admin/content; an empty
   * eyebrow there means she has not written one, not that the pill should show a
   * half-built sentence.
   */
  const eyebrow =
    section?.eyebrow ||
    [
      propertyData.city,
      propertyData.host.isSuperhost
        ? `${copy.contact.superhost} ${propertyData.rating.toFixed(1)}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ')

  useEffect(() => {
    if (total <= 1) return
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % total)
    }, 5500)

    return () => window.clearInterval(id)
  }, [total])

  /**
   * Every gallery photo rotates, but only three are ever in the page.
   *
   * The bug: `images.slice(0, 5)` was rendered while the timer counted
   * `images.length`. With twelve photos the index walked to eleven, no slide
   * matched it, and the hero went **blank** from the sixth turn onwards — a
   * booking page showing a plain background every thirty seconds. Two numbers
   * that had to agree, and did not.
   *
   * Mounting all twelve fixes that and costs too much: measured at **3.3 MB** on
   * first load, because `loading="lazy"` does nothing for images that are in the
   * viewport — an opacity of zero still counts as visible.
   *
   * So the window is previous, current and next. The next one has the full turn
   * to load before it is needed, and the previous stays until its fade is over.
   * Rotation covers every photo; the network only ever sees three.
   */
  const visible = (slide: number) =>
    slide === index || slide === (index + 1) % total || slide === (index - 1 + total) % total

  return (
    <section id="inicio" className="relative isolate overflow-hidden pt-24 sm:pt-28">
      <div className="absolute inset-0 z-0">
        {images.map((src, slideIndex) =>
          !visible(slideIndex) ? null : (
            <Image
              key={src}
              src={src}
              alt={copy.ui.heroAlt}
              fill
              priority={slideIndex === 0}
              loading={slideIndex === 0 ? undefined : 'lazy'}
              className={cn(
                'object-cover transition-opacity duration-1000 ease-in-out motion-reduce:transition-none',
                slideIndex === index ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.04]',
              )}
              sizes="100vw"
            />
          ),
        )}
        {/* Two scrims, not one.

            The horizontal pass darkens the side the type sits on; the vertical
            pass melts the photo into the page so the section has no seam. The
            wash this replaces went the other way — cream at 98% over the left —
            which is why the headline had to be ink and why the floating header
            had nothing to sit on. White type over an arbitrary photo is a
            gamble without them, and twelve photos rotate through here. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ocean-deep/90 via-ocean-deep/65 to-ocean-deep/25" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-24">
        <div className="animate-rise text-white">
          {eyebrow && (
            <span className="glass-dark inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-white">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              {eyebrow}
            </span>
          )}

          <h1 className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {title ? (
              <HeroTitle text={title} />
            ) : (
              <>
                {copy.heroTitle[0]} {copy.heroTitle[1]}{' '}
                <GradientTail>{copy.heroTitle[2]}</GradientTail>
              </>
            )}
          </h1>

          <p className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-white sm:text-lg">
            {subtitle || copy.heroDescription}
            <span className="mt-1 block">{subline || copy.heroSubline}</span>
          </p>

          <Link
            href={section?.ctaHref || '#reservar'}
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-float transition-all hover:-translate-y-0.5"
          >
            {ctaLabel || copy.heroCta}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>

          {badges.length > 0 && (
            <ul className="mt-9 flex flex-wrap gap-2.5">
              {badges.map((badge) => (
                <li
                  key={badge.id}
                  className="glass-dark inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium text-white"
                >
                  <ContentIcon name={badge.icon} className="h-4 w-4 shrink-0 text-accent" />
                  {badge.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div id="reservar" className="animate-rise scroll-mt-28 [animation-delay:120ms]">
          <AvailabilityCard />
        </div>
      </div>
    </section>
  )
}

/** The sand-to-amber wash the reference gives the last words of the headline. */
function GradientTail({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-accent to-sand bg-clip-text text-transparent">
      {children}
    </span>
  )
}

/**
 * Splits the heading so the last few words carry the wash. Purely
 * presentational: the host writes one sentence and doesn't have to think about
 * line breaks or which words to mark.
 */
function HeroTitle({ text }: { text: string }) {
  const words = text.trim().split(/\s+/)
  const tailFrom = Math.max(1, words.length - 2)
  const lead = words.slice(0, tailFrom).join(' ')
  const tail = words.slice(tailFrom).join(' ')

  return (
    <>
      {lead} <GradientTail>{tail}</GradientTail>
    </>
  )
}
