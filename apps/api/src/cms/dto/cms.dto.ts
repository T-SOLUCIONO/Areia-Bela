import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator'
import {
  CMSPageSlug,
  ContentItemKind,
  ContentSectionKey,
  FAQCategory,
  WhatsAppProvider,
} from '@prisma/client'

/**
 * Bilingual fields are required in both languages on purpose: a half-translated
 * site is worse than an untranslated one, and CLAUDE.md forbids shipping copy
 * in one language only.
 */
export class UpdateCMSPageDto {
  @IsString() @MinLength(1) title!: string
  @IsString() @MinLength(1) body!: string

  @IsOptional() @IsBoolean() published?: boolean
}

export class CreateFAQDto {
  @IsString() @MinLength(1) question!: string
  @IsString() @MinLength(1) answer!: string

  @IsOptional() @IsEnum(FAQCategory) category?: FAQCategory
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number
  @IsOptional() @IsBoolean() published?: boolean
}

export class UpdateFAQDto {
  @IsOptional() @IsString() @MinLength(1) question?: string
  @IsOptional() @IsString() @MinLength(1) answer?: string
  @IsOptional() @IsEnum(FAQCategory) category?: FAQCategory
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number
  @IsOptional() @IsBoolean() published?: boolean
}

export class UpdateGalleryImageDto {
  @IsOptional() @IsString() @MinLength(1) alt?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number
  @IsOptional() @IsBoolean() published?: boolean
}

/** Drag-and-drop reordering sends the whole list, so one write settles it. */
export class ReorderDto {
  @IsString({ each: true }) ids!: string[]
}

export class UpdateSiteSettingsDto {
  @IsEmail() contactEmail!: string
  @IsString() @MinLength(1) contactPhone!: string
  @IsString() @MinLength(1) whatsapp!: string
  @IsString() @MinLength(1) seoTitle!: string
  @IsString() @MinLength(1) seoDescription!: string

  @IsOptional() @IsUrl() instagramUrl?: string
  @IsOptional() @IsUrl() facebookUrl?: string
  @IsOptional() @IsUrl() airbnbUrl?: string
  // Not @IsUrl: the dev storage fallback returns a relative "/uploads/…" path.
  @IsOptional() @IsString() logoUrl?: string | null
  // The same mark drawn for a dark page, and the tab icon. Null in either means
  // "use the one that ships with the site", not "no logo".
  @IsOptional() @IsString() logoDarkUrl?: string | null
  @IsOptional() @IsString() faviconUrl?: string | null

  // Where the host is told about bookings. Empty falls back to the public
  // fields above, so one address does not have to be typed twice.
  @IsOptional() @IsString() notifyEmail?: string
  @IsOptional() @IsString() notifyWhatsapp?: string
  @IsOptional() @IsBoolean() notifyOnBooking?: boolean
  @IsOptional() @IsBoolean() notifyOnCancel?: boolean
  @IsOptional() @IsString() notifyTelegram?: string
  @IsOptional() @IsBoolean() notifyOnChange?: boolean
  @IsOptional() @IsBoolean() notifyOnMessage?: boolean

  /**
   * Which company carries the WhatsApp message.
   *
   * `@IsEnum` and not a plain string: the value goes straight into a Prisma
   * enum column, so anything else is a 500 from the database instead of a 400
   * naming the field.
   */
  @IsOptional() @IsEnum(WhatsAppProvider) whatsappProvider?: WhatsAppProvider
}

// --- Landing page content ----------------------------------------------------

/**
 * Every text slot is optional here, unlike UpdateCMSPageDto: a section uses
 * three or four of the slots and leaves the rest blank, so requiring both
 * languages of all of them would make it unsaveable. The paired check
 * (`…Es` present implies `…En` present) is enforced in the service, where it
 * can look at what actually arrived.
 */
export class UpdateContentSectionDto {
  @IsOptional() @IsString() eyebrow?: string
  @IsOptional() @IsString() title?: string
  @IsOptional() @IsString() subtitle?: string
  @IsOptional() @IsString() body?: string
  @IsOptional() @IsString() ctaLabel?: string
  @IsOptional() @IsString() ctaHref?: string
  @IsOptional() @IsString() statValue?: string
  @IsOptional() @IsString() statLabel?: string
  @IsOptional() @IsString() imageUrl?: string | null
  @IsOptional() @IsString() linkUrl?: string | null
  @IsOptional() @IsBoolean() published?: boolean
}

export class CreateContentItemDto {
  @IsEnum(ContentSectionKey) sectionKey!: ContentSectionKey
  @IsEnum(ContentItemKind) kind!: ContentItemKind
  @IsString() @MinLength(1) label!: string

  @IsOptional() @IsString() icon?: string
  @IsOptional() @IsString() imageUrl?: string | null
  @IsOptional() @IsString() body?: string
  @IsOptional() @IsString() value?: string
  @IsOptional() @IsBoolean() published?: boolean
}

export class UpdateContentItemDto {
  @IsOptional() @IsString() @MinLength(1) label?: string
  @IsOptional() @IsString() icon?: string
  @IsOptional() @IsString() imageUrl?: string | null
  @IsOptional() @IsString() body?: string
  @IsOptional() @IsString() value?: string
  @IsOptional() @IsBoolean() published?: boolean
}

export class CreateReviewDto {
  @IsString() @MinLength(1) authorName!: string
  @IsString() @MinLength(1) text!: string

  @IsOptional() @IsString() authorPhotoUrl?: string | null
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) rating?: number
  @IsOptional() @IsString() stayedAt?: string
  @IsOptional() @IsBoolean() verified?: boolean
  @IsOptional() @IsBoolean() featured?: boolean
  @IsOptional() @IsBoolean() published?: boolean
}

export class UpdateReviewDto {
  @IsOptional() @IsString() @MinLength(1) authorName?: string
  @IsOptional() @IsString() @MinLength(1) text?: string
  @IsOptional() @IsString() authorPhotoUrl?: string | null
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) rating?: number
  @IsOptional() @IsString() stayedAt?: string
  @IsOptional() @IsBoolean() verified?: boolean
  @IsOptional() @IsBoolean() featured?: boolean
  @IsOptional() @IsBoolean() published?: boolean
}

/** Source and target are fixed to the two languages the product supports. */
export class TranslateDto {
  @IsString() @MinLength(1) text!: string
  @IsEnum(['es', 'en']) from!: 'es' | 'en'
  @IsEnum(['es', 'en']) to!: 'es' | 'en'
}

export { CMSPageSlug, FAQCategory, ContentSectionKey, ContentItemKind }
