'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Phone, Mail, ArrowUpRight } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { propertyInfo } from '@/lib/mock-data'
import { propertyData } from '@/lib/property-data'
import { useLanguage } from '@/components/language-provider'
import { useSiteContent } from '@/components/public/site-content-provider'
import { translations } from '@/lib/i18n'

export function Footer() {
  const { language } = useLanguage()
  const copy = translations[language].footer
  const perNight = translations[language].quote.perNight

  // Contact details are editable in /admin/settings; the bundled values are
  // the fallback when the API is unreachable.
  const content = useSiteContent()
  const settings = content?.settings
  const logo = settings?.logoUrl ?? '/areia-bela-logo.png'
  const phone = settings?.contactPhone || propertyInfo.phone
  const email = settings?.contactEmail || propertyInfo.email
  const footerSection = content?.sections.FOOTER
  const description = footerSection ? footerSection.body || copy.description : copy.description
  const social = [
    { href: settings?.instagramUrl, label: 'Instagram' },
    { href: settings?.facebookUrl, label: 'Facebook' },
    { href: settings?.airbnbUrl, label: 'Airbnb' },
  ].filter((link): link is { href: string; label: string } => Boolean(link.href))

  return (
    <footer className="border-t border-border/70 bg-card/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_0.9fr_0.8fr]">
          <div className="space-y-4">
            <div>
              <Image
                src={logo}
                alt="Areia Bela"
                width={220}
                height={72}
                className="h-auto w-[200px]"
              />
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{propertyInfo.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>{phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{email}</span>
              </div>
            </div>
            {social.length > 0 && (
              <div className="flex flex-wrap gap-4 pt-1 text-sm">
                {social.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground">
              {copy.explore}
            </h3>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <Link
                href="#gallery"
                className="inline-flex min-h-11 items-center justify-between rounded-full border border-border/70 px-4 transition-colors hover:bg-muted hover:text-foreground"
              >
                {copy.photos} <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="#amenities"
                className="inline-flex min-h-11 items-center justify-between rounded-full border border-border/70 px-4 transition-colors hover:bg-muted hover:text-foreground"
              >
                {copy.services} <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="#reviews"
                className="inline-flex min-h-11 items-center justify-between rounded-full border border-border/70 px-4 transition-colors hover:bg-muted hover:text-foreground"
              >
                {copy.reviews} <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground">
              {copy.reserve}
            </h3>
            <div className="rounded-3xl border border-border/70 bg-background p-5">
              <p className="text-sm text-muted-foreground">{copy.from}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                ${propertyData.pricing.price_per_night}{' '}
                <span className="text-sm font-normal text-foreground/70">{perNight}</span>
              </p>
              <Button
                asChild
                className="mt-4 h-11 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Link href="#reservar">{copy.availability}</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border/70 pt-5 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Areia Bela. {copy.rights}
        </div>
      </div>
    </footer>
  )
}
