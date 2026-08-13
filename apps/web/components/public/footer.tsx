'use client'

import Link from 'next/link'
import { MapPin, Phone, Mail, ArrowUpRight } from 'lucide-react'
import { propertyInfo } from '@/lib/mock-data'
import { useLanguage } from '@/components/language-provider'
import { useSiteContent } from '@/components/public/site-content-provider'
import { SiteLogo } from '@/components/public/site-logo'
import { translations } from '@/lib/i18n'

export function Footer() {
  const { language } = useLanguage()
  const copy = translations[language].footer

  // Contact details are editable in /admin/settings; the bundled values are
  // the fallback when the API is unreachable.
  const content = useSiteContent()
  const settings = content?.settings
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
    /* Slim, the way the reference ends: a line of who and where, not a wall of
       columns. What the reference does not have — a telephone, an address, an
       inbox, the accounts the host actually answers on — stays, because a guest
       reaching for the phone number should not have to hunt for it. */
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm space-y-4">
            <SiteLogo className="h-14 w-auto" />
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            {social.length > 0 && (
              <div className="flex flex-wrap gap-4 text-sm">
                {social.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:gap-16">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">
                {copy.explore}
              </h3>
              <ul className="mt-4 space-y-1 text-sm">
                {[
                  { href: '#gallery', label: copy.photos },
                  { href: '#amenities', label: copy.services },
                  { href: '#reviews', label: copy.reviews },
                ].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="inline-flex min-h-11 items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary"
                    >
                      {item.label}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">
                {copy.contact}
              </h3>
              <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                <li>
                  <a
                    href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                    className="inline-flex min-h-11 items-center gap-2 transition-colors hover:text-primary"
                  >
                    <Phone className="h-4 w-4 shrink-0" aria-hidden />
                    {phone}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex min-h-11 items-center gap-2 transition-colors hover:text-primary"
                  >
                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                    {email}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {propertyInfo.address}
          </p>
          <p>
            &copy; {new Date().getFullYear()} Areia Bela. {copy.rights}
          </p>
        </div>
      </div>
    </footer>
  )
}
