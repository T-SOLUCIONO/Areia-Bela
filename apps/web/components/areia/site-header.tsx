'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { ThemeToggle } from '@/components/public/theme-toggle'

const NAV = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Galería', href: '#galeria' },
  { label: 'Comodidades', href: '#comodidades' },
  { label: 'Ubicación', href: '#ubicacion' },
]

/**
 * The floating header from the reference: transparent over the hero, frosted once
 * you scroll past it.
 *
 * The `scrolled` state is what makes it work — over the hero photo the bar has no
 * surface of its own, so the white logotype reads against the image; the moment it
 * leaves the photo it takes on glass so the same text has something to sit on.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-3 transition-all duration-300 sm:px-6 ${
          scrolled ? 'glass shadow-soft' : 'border border-transparent'
        }`}
      >
        <a href="#inicio" className="flex min-h-11 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
            <Star className="size-5 fill-current" strokeWidth={1.5} />
          </span>
          <span
            className={`font-display text-lg font-semibold tracking-tight transition-colors ${
              scrolled ? 'text-foreground' : 'text-white'
            }`}
          >
            Areia <span className={scrolled ? 'text-primary' : 'text-accent'}>Bela</span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                scrolled
                  ? 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  : 'text-white/85 hover:text-white'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className={scrolled ? '' : 'border-white/40 text-white'} />
          <a
            href="#reservar"
            className="inline-flex min-h-11 items-center rounded-xl bg-panel px-4 text-sm font-semibold text-panel-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-primary hover:shadow-glow"
          >
            Reservar
          </a>
        </div>
      </div>
    </header>
  )
}
