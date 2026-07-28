import type {
  CMSPage,
  CMSPageSlug,
  ContentItem,
  ContentItemKind,
  ContentSection,
  ContentSectionKey,
  FAQ,
  GalleryImage,
  Review,
  SiteSettings,
} from '@/lib/cms-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/**
 * Server-side reader for the published half of the CMS.
 *
 * Not cached. An edit in the admin has to be visible on the next reload, and a
 * revalidation window meant the host saved a change and saw nothing, which
 * reads as "the editor is broken". Serving this from a CDN, or revalidating on
 * demand when the admin saves, is the performance work in Fase 8 — until then
 * correctness wins, and one API call per render of a single-property site is
 * not the bottleneck.
 *
 * Deliberately failure-tolerant: if the API is down the guest site falls back
 * to the copy bundled in `lib/property-data.ts` rather than erroring. A booking
 * site that 500s because a text service blinked is worse than one showing
 * slightly stale words.
 */
async function read<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { cache: 'no-store' })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

export interface SiteContent {
  pages: Partial<Record<CMSPageSlug, CMSPage>>
  sections: Partial<Record<ContentSectionKey, ContentSection>>
  reviews: Review[]
  faqs: FAQ[]
  images: GalleryImage[]
  settings: SiteSettings | null
  /**
   * Whether the CMS answered at all.
   *
   * This is the difference between "the host hid this section" and "the API is
   * unreachable", which look identical otherwise — the public endpoint omits
   * unpublished sections rather than flagging them, so both cases arrive as an
   * absent key. Without this, hiding a section made it render the bundled
   * fallback copy instead of disappearing.
   */
  available: boolean
}

export async function getSiteContent(): Promise<SiteContent> {
  const [pages, sections, reviews, faqs, images, settings] = await Promise.all([
    read<CMSPage[]>('/cms/pages'),
    read<ContentSection[]>('/cms/landing'),
    read<Review[]>('/cms/reviews'),
    read<FAQ[]>('/cms/faqs'),
    read<GalleryImage[]>('/cms/gallery'),
    read<SiteSettings>('/cms/settings'),
  ])

  return {
    pages: Object.fromEntries((pages ?? []).map((page) => [page.slug, page])),
    sections: Object.fromEntries((sections ?? []).map((section) => [section.key, section])),
    reviews: reviews ?? [],
    faqs: faqs ?? [],
    images: images ?? [],
    settings,
    available: sections !== null,
  }
}

/** The items of one list within a section, already ordered by the API. */
export function itemsOf(section: ContentSection | undefined, kind: ContentItemKind): ContentItem[] {
  return section?.items.filter((item) => item.kind === kind) ?? []
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
