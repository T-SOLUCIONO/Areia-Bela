'use client'

import Link from 'next/link'
import { Button } from '@areia-bela/ui/button'
import { propertyData } from '@/lib/property-data'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/lib/i18n'

export function Reserve() {
  const { language } = useLanguage()
  const copy = translations[language].quote

  return (
    <div className="sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {copy.from}
          </div>
          <div className="text-lg font-semibold text-foreground">
            ${propertyData.pricing.price_per_night}{' '}
            <span className="text-sm font-normal text-muted-foreground">{copy.perNight}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{copy.tagline}</p>
        </div>
        <Button asChild variant="brand" size="lg" className="px-5 text-sm font-semibold">
          <Link href="#reservar">{copy.bookNow}</Link>
        </Button>
      </div>
    </div>
  )
}
