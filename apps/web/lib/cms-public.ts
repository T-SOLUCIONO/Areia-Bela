import type { CMSPage, CMSPageSlug, FAQ, GalleryImage, SiteSettings } from '@/lib/cms-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/** Refetch window for guest-facing content: an edit shows up within a minute. */
const REVALIDATE_SECONDS = 60

/**
 * Server-side reader for the published half of the CMS.
 *
 * Deliberately failure-tolerant: if the API is down the guest site falls back
 * to the copy bundled in `lib/property-data.ts` rather than erroring. A booking
 * site that 500s because a text service blinked is worse than one showing
 * slightly stale words.
 */
async function read<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

export interface SiteContent {
  pages: Partial<Record<CMSPageSlug, CMSPage>>
  faqs: FAQ[]
  images: GalleryImage[]
  settings: SiteSettings | null
}

export async function getSiteContent(): Promise<SiteContent> {
  const [pages, faqs, images, settings] = await Promise.all([
    read<CMSPage[]>('/cms/pages'),
    read<FAQ[]>('/cms/faqs'),
    read<GalleryImage[]>('/cms/gallery'),
    read<SiteSettings>('/cms/settings'),
  ])

  return {
    pages: Object.fromEntries((pages ?? []).map((page) => [page.slug, page])),
    faqs: faqs ?? [],
    images: images ?? [],
    settings,
  }
}

/**
 * Picks the right language column of a bilingual pair (`titleEs`/`titleEn`),
 * falling back to the other when one side is still blank — a half-translated
 * page should show the language it has, not an empty block.
 */
export function localized<F extends string, T extends Record<`${F}Es` | `${F}En`, string>>(
  row: T,
  field: F,
  language: 'es' | 'en',
): string {
  const primary = row[`${field}${language === 'es' ? 'Es' : 'En'}` as keyof T] as string
  const secondary = row[`${field}${language === 'es' ? 'En' : 'Es'}` as keyof T] as string
  return primary?.trim() ? primary : (secondary ?? '')
}
