import type { Metadata } from 'next'
import { Toaster } from '@areia-bela/ui/sonner'
import { Header } from '@/components/public/header'
import { Footer } from '@/components/public/footer'
import { Reserve } from '@/components/public/reserve'
import { SiteContentProvider } from '@/components/public/site-content-provider'
import { getSiteContent } from '@/lib/cms-public'

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
  if (!settings?.seoTitle) return {}

  const { seoTitle: title, seoDescription: description } = settings

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale,
      siteName: 'Areia Bela',
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const content = await getSiteContent(locale)

  return (
    <SiteContentProvider content={content}>
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
