import { apiFetch, API_URL } from '@/lib/api-client'
import { PROPERTY_SLUG } from '@/lib/property-data'

export type CMSPageSlug =
  | 'ABOUT_SPACE'
  | 'ACCOMMODATION'
  | 'LIVING_AREAS'
  | 'KITCHEN_DINING'
  | 'BEDROOMS_BATHROOMS'
  | 'OUTDOOR_LIFE'
  | 'AMENITIES'
  | 'LOCATION'
  | 'GUEST_ACCESS'
  | 'HOUSE_RULES'
  | 'FAQS'
  | 'POLICIES'

export type FAQCategory = 'PETS' | 'TRASH' | 'POOL' | 'PARTIES' | 'GENERAL'
export type ExtraPricingType = 'PER_NIGHT' | 'PER_HOUR' | 'PER_STAY'

export interface CMSPage {
  id: string
  slug: CMSPageSlug
  titleEs: string
  titleEn: string
  bodyEs: string
  bodyEn: string
  published: boolean
  updatedAt: string
}

export interface FAQ {
  id: string
  questionEs: string
  questionEn: string
  answerEs: string
  answerEn: string
  category: FAQCategory
  sortOrder: number
  published: boolean
}

export interface GalleryImage {
  id: string
  url: string
  altEs: string
  altEn: string
  sortOrder: number
  published: boolean
}

export interface SiteSettings {
  contactEmail: string
  contactPhone: string
  whatsapp: string
  seoTitleEs: string
  seoTitleEn: string
  seoDescriptionEs: string
  seoDescriptionEn: string
  instagramUrl: string | null
  facebookUrl: string | null
  airbnbUrl: string | null
}

export interface Extra {
  id: string
  key: string
  nameEs: string
  nameEn: string
  pricingType: ExtraPricingType
  price: string
  refundable: boolean
  requiresRequest: boolean
  active: boolean
  seasonStartMonthDay: string | null
  seasonEndMonthDay: string | null
}

export interface PriceRule {
  id: string
  name: string
  type: 'LOW' | 'HIGH' | 'WEEKEND'
  nightlyRate: string
  startDate: string | null
  endDate: string | null
  active: boolean
}

export interface PropertySettings {
  id: string
  slug: string
  nameEs: string
  nameEn: string
  descriptionEs: string
  descriptionEn: string
  maxGuests: number
  bedrooms: number
  bathrooms: number
  additionalGuestFeePerNight: string
  cleaningFee: string
  serviceFeePercent: string
  taxesPercent: string
  address: string
  city: string
  state: string
  country: string
  checkInTime: string
  checkOutTime: string
  amenities: string[]
  trashCollectionDays: string[]
  extras: Extra[]
  priceRules: PriceRule[]
}

/**
 * What PATCH /properties/:slug accepts. Money comes back from Prisma as a
 * Decimal string but has to go out as a number, so this is not just a
 * `Partial<PropertySettings>`.
 */
export type PropertyUpdate = Partial<
  Omit<
    PropertySettings,
    | 'id'
    | 'slug'
    | 'extras'
    | 'priceRules'
    | 'additionalGuestFeePerNight'
    | 'cleaningFee'
    | 'serviceFeePercent'
    | 'taxesPercent'
  > & {
    additionalGuestFeePerNight: number
    cleaningFee: number
    serviceFeePercent: number
    taxesPercent: number
  }
>

/** Same Decimal-to-number conversion as PropertyUpdate, for the extra's price. */
export type ExtraUpdate = Partial<Omit<Extra, 'id' | 'key' | 'price'> & { price: number }>

/** True when a page still carries the same text in both languages. */
export function needsTranslation(page: CMSPage): boolean {
  return page.bodyEs.trim() === page.bodyEn.trim()
}

export const cms = {
  pages: () => apiFetch<CMSPage[]>('/cms/admin/pages'),
  savePage: (slug: CMSPageSlug, body: Partial<CMSPage>) =>
    apiFetch<CMSPage>(`/cms/pages/${slug}`, { method: 'PATCH', body: JSON.stringify(body) }),

  faqs: () => apiFetch<FAQ[]>('/cms/admin/faqs'),
  createFaq: (body: Partial<FAQ>) =>
    apiFetch<FAQ>('/cms/faqs', { method: 'POST', body: JSON.stringify(body) }),
  updateFaq: (id: string, body: Partial<FAQ>) =>
    apiFetch<FAQ>(`/cms/faqs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteFaq: (id: string) => apiFetch<void>(`/cms/faqs/${id}`, { method: 'DELETE' }),
  reorderFaqs: (ids: string[]) =>
    apiFetch<FAQ[]>('/cms/faqs/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) }),

  gallery: () => apiFetch<GalleryImage[]>('/cms/admin/gallery'),
  updateImage: (id: string, body: Partial<GalleryImage>) =>
    apiFetch<GalleryImage>(`/cms/gallery/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteImage: (id: string) => apiFetch<void>(`/cms/gallery/${id}`, { method: 'DELETE' }),
  reorderImages: (ids: string[]) =>
    apiFetch<GalleryImage[]>('/cms/gallery/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    }),

  settings: () => apiFetch<SiteSettings | null>('/cms/settings'),
  saveSettings: (body: SiteSettings) =>
    apiFetch<SiteSettings>('/cms/settings', { method: 'PATCH', body: JSON.stringify(body) }),

  property: () => apiFetch<PropertySettings>(`/properties/${PROPERTY_SLUG}`),
  saveProperty: (body: PropertyUpdate) =>
    apiFetch<PropertySettings>(`/properties/${PROPERTY_SLUG}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  updateExtra: (id: string, body: ExtraUpdate) =>
    apiFetch<Extra>(`/properties/extras/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deactivateExtra: (id: string) =>
    apiFetch<Extra>(`/properties/extras/${id}`, { method: 'DELETE' }),

  /**
   * Uploads bypass apiFetch: it sets a JSON content-type, and multipart needs
   * the browser to set its own boundary.
   */
  async uploadImage(file: File, altEs: string, altEn: string): Promise<GalleryImage> {
    const form = new FormData()
    form.append('file', file)
    form.append('altEs', altEs)
    form.append('altEn', altEn)

    const response = await fetch(`${API_URL}/cms/gallery`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { message?: string } | null
      throw new Error(detail?.message ?? 'Upload failed')
    }
    return (await response.json()) as GalleryImage
  },
}
