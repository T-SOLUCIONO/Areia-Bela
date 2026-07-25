export type Locale = 'es' | 'en'

export type CMSPageSlug =
  | 'about-space'
  | 'accommodation'
  | 'living-areas'
  | 'kitchen-dining'
  | 'bedrooms-bathrooms'
  | 'outdoor-life'
  | 'amenities'
  | 'location'
  | 'guest-access'
  | 'house-rules'
  | 'faqs'
  | 'policies'

export interface CMSPageContent {
  title: string
  body: string
}

export interface CMSPage {
  id: string
  slug: CMSPageSlug
  content: Record<Locale, CMSPageContent>
  updatedAt: string
}

export interface FAQ {
  id: string
  question: Record<Locale, string>
  answer: Record<Locale, string>
  category: 'pets' | 'trash' | 'pool' | 'parties' | 'general'
  order: number
}

export interface GalleryImage {
  id: string
  url: string
  alt: Record<Locale, string>
  order: number
}

export interface SiteSettings {
  contactEmail: string
  contactPhone: string
  whatsapp: string
  socialLinks: Record<string, string>
  seoTitle: Record<Locale, string>
  seoDescription: Record<Locale, string>
  defaultLocale: Locale
}
