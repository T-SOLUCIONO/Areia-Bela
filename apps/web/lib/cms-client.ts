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
  title: string
  body: string
  published: boolean
  updatedAt: string
}

export interface FAQ {
  id: string
  question: string
  answer: string
  category: FAQCategory
  sortOrder: number
  published: boolean
}

export interface GalleryImage {
  id: string
  url: string
  alt: string
  sortOrder: number
  published: boolean
}

export interface SiteSettings {
  contactEmail: string
  contactPhone: string
  whatsapp: string
  seoTitle: string
  seoDescription: string
  instagramUrl: string | null
  facebookUrl: string | null
  airbnbUrl: string | null
  logoUrl: string | null
  logoDarkUrl: string | null
  faviconUrl: string | null
  notifyEmail: string
  notifyWhatsapp: string
  notifyTelegram: string
  whatsappProvider: 'TWILIO' | 'META'
  notifyOnBooking: boolean
  notifyOnCancel: boolean
  notifyOnChange: boolean
  notifyOnMessage: boolean
}

export interface Extra {
  id: string
  key: string
  name: string
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
  name: string
  description: string
  maxGuests: number
  bedrooms: number
  bathrooms: number
  additionalGuestFeePerNight: string
  minNights: number
  maxNights: number
  weeklyDiscountPercent: string
  weeklyDiscountNights: number
  cancellationPolicy: 'FLEXIBLE' | 'MODERATE' | 'FIRM' | 'STRICT'
  accessNotes: string | null
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
    | 'weeklyDiscountPercent'
    | 'accessNotes'
  > & {
    additionalGuestFeePerNight: number
    cleaningFee: number
    serviceFeePercent: number
    taxesPercent: number
    weeklyDiscountPercent: number
    accessNotes?: string
  }
>

/** Same Decimal-to-number conversion as PropertyUpdate, for the extra's price. */
export type ExtraUpdate = Partial<Omit<Extra, 'id' | 'key' | 'price'> & { price: number }>

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

  /** Which channels can actually reach the host right now. */
  notificationStatus: () =>
    apiFetch<{
      email: boolean
      whatsapp: boolean
      whatsappConfigured: boolean
      whatsappProvider: 'TWILIO' | 'META'
      twilioConfigured: boolean
      metaConfigured: boolean
      /** Meta's own words when it refuses the token — English, and never null-safe to concatenate. */
      metaProblem: string | null
      /** Whether alerts go out as an approved template, i.e. outside the 24-hour window too. */
      metaTemplate: boolean
      /** Meta's status word for that template, or `MISSING` when the name is not in the account. */
      metaTemplateStatus: string | null
      telegram: boolean
      telegramConfigured: boolean
    }>('/notifications/status'),

  settings: () => apiFetch<SiteSettings | null>('/cms/settings'),
  storageStatus: () => apiFetch<{ backend: 'gcs' | 'blob' | 'local' }>('/cms/storage'),

  /**
   * Sends only what the host can edit.
   *
   * The panel loads the whole row and sends it straight back, and the row
   * carries `id` and `updatedAt` — which the API rejects, because
   * `forbidNonWhitelisted` is on and neither belongs in a DTO the browser
   * fills. Saving the site settings had therefore **never worked**: every
   * attempt came back 400 naming fields nobody had typed.
   *
   * Picking here rather than trusting the caller is deliberate. TypeScript
   * cannot help — a wider object satisfies a narrower type, and excess property
   * checks only apply to literals — so the boundary has to do it. And the
   * failure mode of forgetting a field is that one field does not save, not
   * that the whole form stops working.
   */
  saveSettings: (body: SiteSettings) =>
    apiFetch<SiteSettings>('/cms/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        whatsapp: body.whatsapp,
        seoTitle: body.seoTitle,
        seoDescription: body.seoDescription,
        instagramUrl: body.instagramUrl,
        facebookUrl: body.facebookUrl,
        airbnbUrl: body.airbnbUrl,
        logoUrl: body.logoUrl,
        logoDarkUrl: body.logoDarkUrl,
        faviconUrl: body.faviconUrl,
        notifyEmail: body.notifyEmail,
        notifyWhatsapp: body.notifyWhatsapp,
        notifyTelegram: body.notifyTelegram,
        whatsappProvider: body.whatsappProvider,
        notifyOnBooking: body.notifyOnBooking,
        notifyOnCancel: body.notifyOnCancel,
        notifyOnChange: body.notifyOnChange,
        notifyOnMessage: body.notifyOnMessage,
      }),
    }),

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
  async uploadImage(file: File, alt: string): Promise<GalleryImage> {
    const form = new FormData()
    form.append('file', file)
    form.append('alt', alt)

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

// --- Landing page ------------------------------------------------------------

export type ContentSectionKey =
  'HERO' | 'FEATURES' | 'AMENITIES' | 'REVIEWS' | 'LOCATION' | 'DIRECT_BOOKING' | 'HOST' | 'FOOTER'

export type ContentItemKind =
  'HERO_BADGE' | 'FEATURE_CARD' | 'AMENITY' | 'LOCATION_HIGHLIGHT' | 'HOST_STAT' | 'REVIEW_RATING'

export interface ContentItem {
  id: string
  sectionId: string
  kind: ContentItemKind
  icon: string
  imageUrl: string | null
  label: string
  body: string
  value: string
  sortOrder: number
  published: boolean
}

export interface ContentSection {
  id: string
  key: ContentSectionKey
  eyebrow: string
  title: string
  subtitle: string
  body: string
  ctaLabel: string
  ctaHref: string
  statValue: string
  statLabel: string
  imageUrl: string | null
  linkUrl: string | null
  published: boolean
  items: ContentItem[]
}

export interface Review {
  id: string
  authorName: string
  authorPhotoUrl: string | null
  rating: number
  text: string
  stayedAt: string
  verified: boolean
  featured: boolean
  sortOrder: number
  published: boolean
}

export type ContentSectionUpdate = Partial<Omit<ContentSection, 'id' | 'key' | 'items'>>
export type ContentItemUpdate = Partial<
  Omit<ContentItem, 'id' | 'sectionId' | 'kind' | 'sortOrder'>
>
export type ReviewUpdate = Partial<Omit<Review, 'id' | 'sortOrder'>>

export const landing = {
  sections: () => apiFetch<ContentSection[]>('/cms/admin/landing'),
  saveSection: (key: ContentSectionKey, body: ContentSectionUpdate) =>
    apiFetch<ContentSection>(`/cms/landing/${key}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  createItem: (
    body: { sectionKey: ContentSectionKey; kind: ContentItemKind } & ContentItemUpdate,
  ) => apiFetch<ContentItem>('/cms/landing/items', { method: 'POST', body: JSON.stringify(body) }),
  updateItem: (id: string, body: ContentItemUpdate) =>
    apiFetch<ContentItem>(`/cms/landing/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteItem: (id: string) => apiFetch<void>(`/cms/landing/items/${id}`, { method: 'DELETE' }),
  reorderItems: (ids: string[]) =>
    apiFetch<void>('/cms/landing/items/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    }),

  reviews: () => apiFetch<Review[]>('/cms/admin/reviews'),
  createReview: (body: ReviewUpdate) =>
    apiFetch<Review>('/cms/reviews', { method: 'POST', body: JSON.stringify(body) }),
  updateReview: (id: string, body: ReviewUpdate) =>
    apiFetch<Review>(`/cms/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteReview: (id: string) => apiFetch<void>(`/cms/reviews/${id}`, { method: 'DELETE' }),
  reorderReviews: (ids: string[]) =>
    apiFetch<void>('/cms/reviews/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) }),

  /** Which service translates the site, or null when none is configured. */
  translationStatus: () =>
    apiFetch<{ configured: boolean; provider: string | null }>('/cms/admin/translation-status'),

  /** Multipart, so it can't go through apiFetch — see uploadImage above. */
  async uploadImage(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch(`${API_URL}/cms/landing/upload`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { message?: string } | null
      throw new Error(detail?.message ?? 'Upload failed')
    }
    return ((await response.json()) as { url: string }).url
  },
}
