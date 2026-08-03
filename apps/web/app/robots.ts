import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'

/**
 * What a crawler may read.
 *
 * `/admin` is behind a real session, so this is not what protects it — the
 * middleware and the API guards are. What this prevents is the panel's login
 * page turning up in a search for the house, and crawlers spending their
 * budget on pages that will only ever answer with a redirect.
 *
 * The guest's own area is listed for a different reason: those URLs carry a
 * booking reference, and a reference is not something to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/*/my-booking', '/*/confirmation', '/*/checkout'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
