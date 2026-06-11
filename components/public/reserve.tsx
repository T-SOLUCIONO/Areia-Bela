"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { propertyData } from '@/lib/property-data'
import { useLanguage } from '@/components/language-provider'

export function Reserve() {
  const { language } = useLanguage()
  const isEnglish = language === 'en'

  return (
    <div className="sticky bottom-0 z-40 border-t border-white/70 bg-[rgba(247,242,234,0.96)] px-4 py-3 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{isEnglish ? 'From' : 'Desde'}</div>
          <div className="text-lg font-semibold text-[#173a57]">
            ${propertyData.pricing.price_per_night} <span className="text-sm font-normal text-slate-500">{isEnglish ? '/ night' : '/ noche'}</span>
          </div>
          <p className="truncate text-xs text-slate-500">{isEnglish ? 'Heated Pool & Coffee Bar' : 'Piscina climatizada y coffee bar'}</p>
        </div>
        <Button asChild className="h-11 rounded-full bg-[#174d7a] px-5 text-sm font-semibold text-white hover:bg-[#0f4068]">
          <Link href="#reservar">{isEnglish ? 'Book now' : 'Reservar'}</Link>
        </Button>
      </div>
    </div>
  )
}
