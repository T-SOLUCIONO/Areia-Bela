'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
function LanguageMenu({ compact = false }: { compact?: boolean }) {
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

export function Header() {
  // Editable in /admin/settings; the bundled mark is the fallback.
  const logo = useSiteContent()?.settings?.logoUrl ?? '/areia-bela-logo.png'
  const [isOpen, setIsOpen] = useState(false)
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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/85 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src={logo}
            alt="Areia Bela"
            width={170}
            height={56}
            className="h-auto w-[170px] sm:w-[190px]"
          />
        </Link>

        <nav className="hidden items-center gap-2 lg:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="brand" size="lg" className="font-semibold">
            <Link href="#reservar">{copy.bookNow}</Link>
          </Button>
          <ThemeToggle darkLabel={copy.ui.themeDark} lightLabel={copy.ui.themeLight} />
          <LanguageMenu />
        </div>

        {/* Beside the menu button rather than inside the sheet. Changing
            language is a one-tap decision a visitor makes on arrival, and
            burying it behind the hamburger asked for two taps and a guess about
            where it lived. */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle darkLabel={copy.ui.themeDark} lightLabel={copy.ui.themeLight} />
          <LanguageMenu compact />
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11">
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
                    className="h-auto w-[220px]"
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
