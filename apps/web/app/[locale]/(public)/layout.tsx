import type { Metadata } from 'next'
import { Toaster } from '@areia-bela/ui/sonner'
import { Header } from '@/components/public/header'
import { Footer } from '@/components/public/footer'
import { Reserve } from '@/components/public/reserve'
import { SiteContentProvider } from '@/components/public/site-content-provider'
import { getPublicProperty, getSiteContent } from '@/lib/cms-public'
import { StructuredData } from '@/components/public/structured-data'
import { SITE_URL, languageAlternates } from '@/lib/site-url'

/**
 * Title and description come from the CMS, so the host can change how the site
 * looks in a search result or a shared link without a deploy. The root layout's
 * metadata stays as the fallback for when the API is unreachable.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const { settings } = await getSiteContent(locale)

  // The canonical and the hreflangs do not depend on the CMS answering. They
  // are about which URL is the real one, and that is true whether or not the
  // API is up — an unreachable API used to mean a page with no canonical at
  // all, which invites a search engine to pick one for us.
  const alternates = {
    canonical: `${SITE_URL}/${locale}`,
    languages: languageAlternates(),
  }

  if (!settings?.seoTitle) return { alternates }

  const { seoTitle: title, seoDescription: description } = settings

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      type: 'website',
      locale,
      url: `${SITE_URL}/${locale}`,
      siteName: 'Areia Bela',
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

/** The cheapest night on offer, or nothing. An invented "from" price is the
 *  kind of thing a guest notices at checkout. */
function lowestRate(property: {
  priceRules?: Array<{ nightlyRate: string | number; active: boolean }>
}) {
  const rates = (property.priceRules ?? [])
    .filter((rule) => rule.active)
    .map((rule) => Number(rule.nightlyRate))
    .filter((rate) => rate > 0)
  return rates.length > 0 ? Math.min(...rates) : undefined
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // Both in one round, since neither needs the other.
  const [content, property] = await Promise.all([getSiteContent(locale), getPublicProperty()])

  return (
    <SiteContentProvider content={content}>
      {/* Only when the API answered. Structured data with blank fields tells a
          search engine the house has no address, rather than that we could not
          look one up. */}
      {property && (
        <StructuredData
          locale={locale}
          name={property.name}
          description={content.settings?.seoDescription || property.description}
          address={{
            street: property.address,
            city: property.city,
            state: property.state,
            country: property.country,
          }}
          maxGuests={property.maxGuests}
          bedrooms={property.bedrooms}
          bathrooms={property.bathrooms}
          checkInTime={property.checkInTime}
          checkOutTime={property.checkOutTime}
          fromPerNight={lowestRate(property)}
          images={content.images.slice(0, 6).map((image) => image.url)}
        />
      )}
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Reserve />
        {/* Booking failures happen while the guest is looking at the price
            card, not at the top of the page. A toast reaches them there. */}
        <Toaster position="top-center" richColors closeButton />
      </div>
    </SiteContentProvider>
  )
}
