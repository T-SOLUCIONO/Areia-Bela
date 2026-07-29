'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { AvailabilityCard } from '@/components/public/availability-card'
import { ContentIcon } from '@/lib/content-icons'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/components/language-provider'
import { useSiteContent } from '@/components/public/site-content-provider'
import { itemsOf } from '@/lib/cms-public'
import { translations } from '@/lib/i18n'

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

  useEffect(() => {
    if (total <= 1) return
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % total)
    }, 5500)

    return () => window.clearInterval(id)
  }, [total])

  const slides = useMemo(() => images.slice(0, 5), [images])

  return (
    <section className="relative isolate w-full overflow-hidden bg-[#f7f2ea] text-[#173a57]">
      <div className="absolute inset-0">
        {slides.map((src, slideIndex) => (
          <Image
            key={src}
            src={src}
            alt={copy.ui.heroAlt}
            fill
            priority={slideIndex === 0}
            className={cn(
              'object-cover transition-opacity duration-1000 ease-in-out motion-reduce:transition-none',
              slideIndex === index ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.04]',
            )}
            sizes="100vw"
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(247,242,234,0.98)_0%,rgba(247,242,234,0.76)_18%,rgba(247,242,234,0.24)_50%,rgba(247,242,234,0.08)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.58),transparent_24%),radial-gradient(circle_at_74%_20%,rgba(255,255,255,0.18),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,transparent_0%,rgba(247,242,234,0.12)_35%,rgba(247,242,234,0.9)_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-[1680px] flex-col px-4 pb-4 pt-4 sm:px-6 lg:px-8 xl:px-10 lg:pb-6 lg:pt-6">
        <div className="relative z-10 grid flex-1 items-center gap-10 pb-8 pt-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.78fr)] lg:items-center lg:gap-12 lg:pb-20 lg:pt-6 xl:gap-16">
          <div className="max-w-3xl space-y-5 pt-10 lg:pt-0">
            {/* The last words of the editable title keep the display face the
                bundled three-line version used, so an edit can't break the
                typography. */}
            <h1 className="max-w-2xl font-serif text-[clamp(3.15rem,5.15vw,5.8rem)] leading-[0.92] tracking-tight text-[#173a57]">
              {title ? (
                <HeroTitle text={title} />
              ) : (
                <>
                  {copy.heroTitle[0]}
                  <span className="block">{copy.heroTitle[1]}</span>
                  <span
                    className="mt-1 block italic text-[#2a5b84]"
                    style={{ fontFamily: "'Areia Bela'", fontSize: '1.03em' }}
                  >
                    {copy.heroTitle[2]}
                  </span>
                </>
              )}
            </h1>

            <p className="max-w-2xl text-[16px] leading-8 text-[#5d6b77]">
              {subtitle || copy.heroDescription}
              <span className="mt-1 block">{subline || copy.heroSubline}</span>
            </p>

            <Button asChild variant="brand" size="lg" className="px-6 text-sm font-semibold">
              <Link href={section?.ctaHref || '#reservar'}>
                {ctaLabel || copy.heroCta}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div
            id="reservar"
            className="relative z-20 lg:justify-self-end lg:self-center lg:-translate-y-3"
          >
            <AvailabilityCard className="w-full max-w-[430px] border border-white/75 bg-white/95 shadow-[0_32px_100px_rgba(15,23,42,0.18)] backdrop-blur-xl" />
          </div>
        </div>

        {badges.length > 0 && (
          <div className="relative z-10 mt-auto grid grid-cols-2 gap-3 pb-2 md:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="flex min-h-16 items-center gap-3 rounded-full border border-white/75 bg-white/85 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#174d7a]/10 text-[#174d7a]">
                  <ContentIcon name={badge.icon} className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-slate-700">{badge.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * Splits the heading so the last few words keep the brand's script face, the
 * way the original three-line hero did. Purely presentational: the host writes
 * one sentence and doesn't have to think about line breaks.
 */
function HeroTitle({ text }: { text: string }) {
  const words = text.trim().split(/\s+/)
  const scriptFrom = Math.max(1, words.length - 2)
  const lead = words.slice(0, scriptFrom).join(' ')
  const tail = words.slice(scriptFrom).join(' ')

  return (
    <>
      {lead}
      <span
        className="mt-1 block italic text-[#2a5b84]"
        style={{ fontFamily: "'Areia Bela'", fontSize: '1.03em' }}
      >
        {tail}
      </span>
    </>
  )
}
