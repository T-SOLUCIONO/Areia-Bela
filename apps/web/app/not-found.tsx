'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@areia-bela/shared'
import type { Language } from '@/lib/i18n'

const copy = {
  en: {
    kicker: 'Page not found',
    title: 'This page drifted out with the tide',
    body: "We couldn't find what you were looking for — but the house is still standing, and the pool is still warm.",
    home: 'Back to home',
    availability: 'Check availability',
  },
  es: {
    kicker: 'Página no encontrada',
    title: 'Esta página se fue con la marea',
    body: 'No encontramos lo que buscabas, pero la casa sigue en pie y la piscina sigue tibia.',
    home: 'Volver al inicio',
    availability: 'Ver disponibilidad',
  },
} satisfies Record<Language, Record<string, string>>

export default function NotFound() {
  // Resolved from the URL rather than useLanguage(): this boundary renders
  // above the `[locale]` layout that provides the context. Public-site paths
  // always carry a locale prefix (middleware adds it), so this matches.
  const pathname = usePathname()
  const language =
    SUPPORTED_LOCALES.find(
      (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    ) ?? DEFAULT_LOCALE
  const text = copy[language]

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
      <div className="relative z-10 max-w-xl pb-40">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">
          {text.kicker}
        </p>

        <div className="animate-wave-bob">
          <p
            aria-hidden
            className="mt-6 font-serif text-[clamp(7rem,22vw,14rem)] leading-[0.8] tracking-tight text-foreground"
          >
            404
          </p>
        </div>

        <h1 className="mt-8 font-serif text-3xl leading-tight text-foreground sm:text-4xl">
          {text.title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">
          {text.body}
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="w-full font-semibold sm:w-auto">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              {text.home}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/#reservar">
              <CalendarDays className="h-4 w-4" />
              {text.availability}
            </Link>
          </Button>
        </div>
      </div>

      {/* Layered waves: the signature element. Decorative only. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-64">
        <div className="absolute inset-x-0 bottom-0 h-full w-[200%] animate-wave-drift-slow">
          <Wave className="text-primary/10" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[78%] w-[200%] animate-wave-drift">
          <Wave className="text-primary/20" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[52%] w-[200%] animate-wave-drift-slow">
          <Wave className="text-primary/30" />
        </div>
      </div>
    </main>
  )
}

function Wave({ className }: { className?: string }) {
  return (
    <svg
      className={`h-full w-full ${className ?? ''}`}
      viewBox="0 0 1440 240"
      preserveAspectRatio="none"
      fill="currentColor"
    >
      {/*
        Crest period is 360 units. The element renders at 200% width and drifts
        by -50% (= 720 units = exactly 2 periods), so the loop is seamless:
        y is 96 at x=0, x=720 and x=1440.
      */}
      <path d="M0 96c90 0 90 40 180 40s90-40 180-40 90 40 180 40 90-40 180-40 90 40 180 40 90-40 180-40 90 40 180 40 90-40 180-40V240H0Z" />
    </svg>
  )
}
