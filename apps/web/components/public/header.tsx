'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Globe, Menu } from 'lucide-react'
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
import { languages, type Language } from '@/lib/i18n'
import { translations } from '@/lib/i18n'
import { useLanguage } from '@/components/language-provider'
import { useSiteContent } from '@/components/public/site-content-provider'
import { publicNavItems } from '@/components/public/public-navigation'

export function Header() {
  // Editable in /admin/settings; the bundled mark is the fallback.
  const logo = useSiteContent()?.settings?.logoUrl ?? '/areia-bela-logo.png'
  const [isOpen, setIsOpen] = useState(false)
  const { language, setLanguage } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const copy = translations[language]
  const navigation = publicNavItems.map((item, index) => ({
    name: copy.nav[index],
    href: item.href,
  }))

  const changeLanguage = (next: Language) => {
    setLanguage(next)
    const segments = pathname.split('/')
    if (segments[1] === 'en' || segments[1] === 'es') {
      segments[1] = next
    } else {
      segments.splice(1, 0, next)
    }
    router.push(segments.join('/') || '/')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/60 bg-[rgba(255,251,246,0.85)] backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(255,251,246,0.72)]">
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
              className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-primary"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="brand" size="lg" className="font-semibold">
            <Link href="#reservar">{copy.bookNow}</Link>
          </Button>
          {/* A dropdown rather than five pills: at two languages a row of
              buttons was tidy, at five it crowds the header — and the menu has
              room for the language's own name, which is what a visitor scans
              for. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 rounded-full bg-white/80"
                aria-label={language === 'en' ? 'Change language' : 'Cambiar idioma'}
              >
                <Globe className="h-4 w-4" aria-hidden />
                <span className="text-xs font-semibold tracking-[0.18em]">
                  {language.toUpperCase()}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {languages.map((item) => (
                <DropdownMenuItem
                  key={item.code}
                  onSelect={() => changeLanguage(item.code)}
                  className={item.code === language ? 'font-semibold text-primary' : undefined}
                >
                  {item.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">{language === 'en' ? 'Toggle menu' : 'Abrir menú'}</span>
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
                    className="text-lg font-medium text-slate-800 transition-colors hover:text-primary"
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
                <div className="grid gap-3 rounded-2xl border border-border bg-background p-4">
                  <div className="text-sm font-medium text-foreground">
                    {language === 'en' ? 'Language' : 'Idioma'}
                  </div>
                  {/* On a phone there is room to list them, and tapping a
                      language name is a bigger target than a two-letter pill. */}
                  <div className="grid grid-cols-2 gap-2">
                    {languages.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => changeLanguage(item.code)}
                        className={
                          item.code === language
                            ? 'rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground'
                            : 'rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground'
                        }
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
