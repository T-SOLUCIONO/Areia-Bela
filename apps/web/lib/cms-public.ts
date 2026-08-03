import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from '@areia-bela/shared'
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
const PROPERTY_SLUG = 'areia-bela'

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
   * unreachable", which look identical otherwise — the endpoint omits
   * unpublished sections rather than flagging them, so both arrive as an
   * absent key. Without this, hiding a section made it render the bundled
   * fallback copy instead of disappearing.
   */
  available: boolean
}

interface SitePayload {
  pages: CMSPage[]
  sections: ContentSection[]
  reviews: Review[]
  faqs: FAQ[]
  images: GalleryImage[]
  settings: SiteSettings | null
}

const EMPTY: SiteContent = {
  pages: {},
  sections: {},
  reviews: [],
  faqs: [],
  images: [],
  settings: null,
  available: false,
}

/**
 * The whole guest site, already in the visitor's language.
 *
 * The API resolves the translations, so nothing here knows about languages
 * beyond passing one along: a field is just a string that arrives in the right
 * language, or in the language it was written in when no translation exists.
 *
 * Not cached. An edit in the admin has to be visible on the next reload, and a
 * revalidation window meant the host saved a change and saw nothing, which
 * reads as "the editor is broken". Serving this from a CDN, or revalidating on
 * demand when the admin saves, is the performance work in Fase 8.
 *
 * Failure-tolerant: if the API is down the site falls back to the copy bundled
 * in `lib/property-data.ts` rather than erroring. A booking site that 500s
 * because a text service blinked is worse than one showing slightly stale words.
 */
export async function getSiteContent(locale: string = DEFAULT_LOCALE): Promise<SiteContent> {
  const language: SupportedLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE

  try {
    const response = await fetch(`${API_URL}/cms/site?locale=${language}`, { cache: 'no-store' })
    if (!response.ok) return EMPTY

    const data = (await response.json()) as SitePayload

    return {
      pages: Object.fromEntries(data.pages.map((page) => [page.slug, page])),
      sections: Object.fromEntries(data.sections.map((section) => [section.key, section])),
      reviews: data.reviews,
      faqs: data.faqs,
      images: data.images,
      settings: data.settings,
      available: true,
    }
  } catch {
    return EMPTY
  }
}

/** The items of one list within a section, already ordered by the API. */
export function itemsOf(section: ContentSection | undefined, kind: ContentItemKind): ContentItem[] {
  return section?.items.filter((item) => item.kind === kind) ?? []
}

/** The facts about the house, for the server-rendered structured data. */
export interface PublicProperty {
  name: string
  description: string
  address: string
  city: string
  state: string
  country: string
  maxGuests: number
  bedrooms: number
  bathrooms: number
  checkInTime: string
  checkOutTime: string
  priceRules?: Array<{ nightlyRate: string | number; active: boolean }>
}

/**
 * The house, from the API.
 *
 * Returns null rather than a shape full of blanks when the API is unreachable:
 * the only caller is the structured data, and structured data with empty
 * fields is worse than none — it tells a search engine the house has no
 * address rather than that we could not look it up.
 */
export async function getPublicProperty(): Promise<PublicProperty | null> {
  try {
    const response = await fetch(`${API_URL}/properties/${PROPERTY_SLUG}`, { cache: 'no-store' })
    if (!response.ok) return null
    return (await response.json()) as PublicProperty
  } catch {
    return null
  }
}
