'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
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
import { publicNavItems } from '@/components/public/public-navigation'

export function Header() {
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
            src="/areia-bela-logo.png"
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
          <div className="flex items-center gap-2 rounded-full border border-border bg-white/80 px-2 py-1 shadow-sm">
            {languages.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => changeLanguage(item.code)}
                className={
                  item.code === language
                    ? 'rounded-full bg-primary px-3 py-1 text-xs font-semibold tracking-[0.18em] text-primary-foreground'
                    : 'rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] text-muted-foreground'
                }
              >
                {item.label}
              </button>
            ))}
          </div>
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
                  src="/areia-bela-logo.png"
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
                  <div className="flex items-center gap-2 rounded-full border border-border px-2 py-1 w-fit">
                    {languages.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => changeLanguage(item.code)}
                        className={
                          item.code === language
                            ? 'rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
                            : 'rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground'
                        }
                      >
                        {item.label}
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
