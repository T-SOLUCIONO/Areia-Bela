import type { MetadataRoute } from 'next'
import { SUPPORTED_LOCALES } from '@areia-bela/shared'
import { SITE_URL, languageAlternates } from '@/lib/site-url'

/**
 * The pages worth indexing.
 *
 * One house means one page, in five languages — and that is the whole sitemap.
 * Checkout, the confirmation and the guest area are all either a step in a
 * transaction or somebody's private booking; listing them would ask a crawler
 * to index a shopping cart.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return SUPPORTED_LOCALES.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: 1,
    // The same declaration the page carries, so the two cannot drift.
    alternates: { languages: languageAlternates() },
  }))
}
