'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Check, Globe, Menu } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@areia-bela/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@areia-bela/ui/sheet'
import { languages } from '@/lib/i18n'
import { translations } from '@/lib/i18n'
import { useLanguage } from '@/components/language-provider'
import { useSiteContent } from '@/components/public/site-content-provider'
import { publicNavItems } from '@/components/public/public-navigation'
import { ThemeToggle } from '@/components/public/theme-toggle'
import { cn } from '@/lib/utils'

/**
 * The language menu, one implementation for both breakpoints.
 *
 * It lived twice: a dropdown for wide screens and a grid of five buttons inside
 * the mobile sheet. Two copies of the same five options meant two places to fix
 * whenever a language was added, and they had already drifted — the sheet
 * version marked the current language by filling it navy, which shouted louder
 * than the booking button right above it.
 *
 * `compact` only changes the trigger's footprint. What it opens is identical.
 */
function LanguageMenu({ compact = false, bare = false }: { compact?: boolean; bare?: boolean }) {
  const { language, setLanguage } = useLanguage()
  const copy = translations[language]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'default' : 'lg'}
          className={cn(
            'gap-2 rounded-full bg-card/80',
            // 44px is the touch minimum, and this one sits beside the menu
            // button where a mis-tap opens the wrong thing.
            compact && 'h-11 px-3',
            // On the bare bar it is white on the photo, like everything else.
            bare && 'border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white',
          )}
          aria-label={copy.ui.changeLanguage}
        >
          <Globe className="h-4 w-4" aria-hidden />
          <span className="text-xs font-semibold tracking-[0.18em]">{language.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((item) => {
          const isCurrent = item.code === language
          return (
            <DropdownMenuItem
              key={item.code}
              onSelect={() => setLanguage(item.code)}
              // Marked, not filled: the check carries the state and the row
              // keeps the same weight as its neighbours.
              className={cn('min-h-11 gap-6', isCurrent && 'font-semibold text-primary')}
            >
              {item.name}
              {isCurrent && <Check className="ml-auto h-4 w-4 shrink-0" aria-hidden />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The floating bar: a frosted pill that hovers over the page, rather than a
 * full-width bar welded to the top with a border under it.
 *
 * On the landing it is `fixed`, so the hero photo runs the full height of the
 * window underneath it and the bar floats on the image. Every other public page —
 * checkout, confirmation, my booking — starts with content at the top and has no
 * photo to float over, so there the bar is `sticky` and occupies its own space
 * instead of covering the first thing the guest came to read.
 *
 * While it rests on the hero it drops the glass altogether: the photo runs
 * uninterrupted from the top of the window and the bar reads as part of it. The
 * moment it leaves the photo it takes on glass, because the same white type has
 * nothing to sit on over a pale page.
 */
export function Header() {
  // Editable in /admin/settings; the bundled mark is the fallback.
  const logo = useSiteContent()?.settings?.logoUrl ?? '/areia-bela-logo.png'
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  // `/es`, `/en`… and nothing deeper: the landing is the only page with a hero.
  const overHero = /^\/[a-z]{2}\/?$/.test(pathname ?? '')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Bare only while the bar is lying on the hero photo.
  const glass = !overHero || scrolled
  // Choosing a language is LanguageMenu's job now; this only reads it.
  const { language } = useLanguage()
  const copy = translations[language]
  /**
   * Paired by position, which had already gone wrong.
   *
   * `publicNavItems` lists five sections and every one of the five locales
   * defines four labels, so the fifth — `#reviews` — got `copy.nav[4]`, which is
   * `undefined`. It rendered a link with no text: 24px wide, invisible, and
   * announced by a screen reader as a link with no name, with a tab stop that
   * goes nowhere. On every page, in every language.
   *
   * Filtering rather than adding a label: putting "Reviews" in five languages
   * would be inventing copy, and the site already behaves as if the nav has four
   * items. So an item without a label is dropped instead of rendered empty, which
   * also means the next section added to `publicNavItems` fails visibly by being
   * absent rather than invisibly by being blank.
   *
   * If Reviews belongs in the nav, it needs a fifth label in all five locales —
   * that is copy the host owns, not something to guess here.
   */
  const navigation = publicNavItems
    .map((item, index) => ({ name: copy.nav[index] as string | undefined, href: item.href }))
    .filter((item): item is { name: string; href: string } => Boolean(item.name?.trim()))

  return (
    /* `pointer-events-none` on the frame, restored on the pill: the padding
       around a fixed bar is a transparent strip the width of the page, and it
       would otherwise swallow every click landing near the top of the hero. */
    <header
      className={cn(
        'inset-x-0 top-0 z-50 pointer-events-none px-3 pt-3 sm:px-5 sm:pt-4',
        overHero ? 'fixed' : 'sticky pb-3 sm:pb-4',
      )}
    >
      <div
        className={cn(
          'pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-3 transition-all duration-300 sm:px-6',
          glass ? 'glass shadow-soft' : 'border border-transparent',
        )}
      >
        <Link href="/" className="flex min-h-11 items-center">
          <Image
            src={logo}
            alt="Areia Bela"
            width={170}
            height={68}
            // Height-bound rather than width-bound: the pill is 68px tall and a
            // 170px-wide logo of unknown aspect ratio decides how tall it wants
            // to be. The host can swap the file in /admin/settings without the
            // header changing height.
            //
            // Flattened to white in dark mode. The mark is black ink on a
            // transparent ground, drawn for a white page: on the dark pill the
            // wordmark all but disappeared while the teal starfish stayed. One
            // file, both themes — better than asking the host for a second logo.
            className={cn(
              'h-9 w-auto sm:h-10',
              // White over the hero's dark scrim, and white again on the dark
              // pill, but left alone on the frosted one in daylight.
              glass ? 'dark:brightness-0 dark:invert' : 'brightness-0 invert',
            )}
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors',
                /* Full-strength ink on the glass, not the reference's muted
                   grey: frosted glass is 72% opaque, so on the landing these
                   links sit on the hero photo showing through, where the muted
                   token measured 3.49:1 against the brightest part of the
                   pool. */
                glass
                  ? 'text-foreground hover:bg-secondary hover:text-primary'
                  : 'text-white hover:text-accent',
              )}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle
            darkLabel={copy.ui.themeDark}
            lightLabel={copy.ui.themeLight}
            className={glass ? undefined : 'border-white/40 text-white hover:bg-white/10'}
          />
          <LanguageMenu bare={!glass} />
          {/* Navy rather than teal, and last in the row: it is the one thing on
              this bar the guest is meant to press. */}
          <Link
            href="#reservar"
            className="inline-flex min-h-11 items-center rounded-xl bg-panel px-4 text-sm font-semibold text-panel-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground hover:shadow-glow"
          >
            {copy.bookNow}
          </Link>
        </div>

        {/* Beside the menu button rather than inside the sheet. Changing
            language is a one-tap decision a visitor makes on arrival, and
            burying it behind the hamburger asked for two taps and a guess about
            where it lived. */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle
            darkLabel={copy.ui.themeDark}
            lightLabel={copy.ui.themeLight}
            className={glass ? undefined : 'border-white/40 text-white hover:bg-white/10'}
          />
          <LanguageMenu compact bare={!glass} />
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-11 w-11',
                  !glass && 'text-white hover:bg-white/10 hover:text-white',
                )}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">{copy.ui.toggleMenu}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="overflow-y-auto">
              <SheetHeader className="pt-8">
                <SheetTitle className="flex justify-center">
                  <Image
                    src={logo}
                    alt="Areia Bela"
                    width={220}
                    height={72}
                    className="h-auto w-[220px] dark:brightness-0 dark:invert"
                  />
                </SheetTitle>
                <SheetDescription className="text-[10px] uppercase tracking-[0.2em]">
                  {language === 'en'
                    ? 'Beach retreat in St. Petersburg'
                    : 'Escapada junto a la playa en St. Petersburg'}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-6 px-4 pb-6">
                <nav className="flex flex-col gap-4">
                  {navigation.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className="text-lg font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {item.name}
                    </Link>
                  ))}
                </nav>

                <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border">
                  <Button asChild variant="brand" size="lg" className="w-full font-semibold">
                    <Link href="#reservar" onClick={() => setIsOpen(false)}>
                      {copy.bookNow}
                    </Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
