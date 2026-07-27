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
import { CMSPageSlug, ContentItemKind, ContentSectionKey, FAQCategory } from '@prisma/client'

/**
 * Bilingual fields are required in both languages on purpose: a half-translated
 * site is worse than an untranslated one, and CLAUDE.md forbids shipping copy
 * in one language only.
 */
export class UpdateCMSPageDto {
  @IsString() @MinLength(1) titleEs!: string
  @IsString() @MinLength(1) titleEn!: string
  @IsString() @MinLength(1) bodyEs!: string
  @IsString() @MinLength(1) bodyEn!: string

  @IsOptional() @IsBoolean() published?: boolean
}

export class CreateFAQDto {
  @IsString() @MinLength(1) questionEs!: string
  @IsString() @MinLength(1) questionEn!: string
  @IsString() @MinLength(1) answerEs!: string
  @IsString() @MinLength(1) answerEn!: string

  @IsOptional() @IsEnum(FAQCategory) category?: FAQCategory
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number
  @IsOptional() @IsBoolean() published?: boolean
}

export class UpdateFAQDto {
  @IsOptional() @IsString() @MinLength(1) questionEs?: string
  @IsOptional() @IsString() @MinLength(1) questionEn?: string
  @IsOptional() @IsString() @MinLength(1) answerEs?: string
  @IsOptional() @IsString() @MinLength(1) answerEn?: string
  @IsOptional() @IsEnum(FAQCategory) category?: FAQCategory
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number
  @IsOptional() @IsBoolean() published?: boolean
}

export class UpdateGalleryImageDto {
  @IsOptional() @IsString() @MinLength(1) altEs?: string
  @IsOptional() @IsString() @MinLength(1) altEn?: string
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
  @IsString() @MinLength(1) seoTitleEs!: string
  @IsString() @MinLength(1) seoTitleEn!: string
  @IsString() @MinLength(1) seoDescriptionEs!: string
  @IsString() @MinLength(1) seoDescriptionEn!: string

  @IsOptional() @IsUrl() instagramUrl?: string
  @IsOptional() @IsUrl() facebookUrl?: string
  @IsOptional() @IsUrl() airbnbUrl?: string
  // Not @IsUrl: the dev storage fallback returns a relative "/uploads/…" path.
  @IsOptional() @IsString() logoUrl?: string | null
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
  @IsOptional() @IsString() eyebrowEs?: string
  @IsOptional() @IsString() eyebrowEn?: string
  @IsOptional() @IsString() titleEs?: string
  @IsOptional() @IsString() titleEn?: string
  @IsOptional() @IsString() subtitleEs?: string
  @IsOptional() @IsString() subtitleEn?: string
  @IsOptional() @IsString() bodyEs?: string
  @IsOptional() @IsString() bodyEn?: string
  @IsOptional() @IsString() ctaLabelEs?: string
  @IsOptional() @IsString() ctaLabelEn?: string
  @IsOptional() @IsString() ctaHref?: string
  @IsOptional() @IsString() statValue?: string
  @IsOptional() @IsString() statLabelEs?: string
  @IsOptional() @IsString() statLabelEn?: string
  @IsOptional() @IsString() imageUrl?: string | null
  @IsOptional() @IsString() linkUrl?: string | null
  @IsOptional() @IsBoolean() published?: boolean
}

export class CreateContentItemDto {
  @IsEnum(ContentSectionKey) sectionKey!: ContentSectionKey
  @IsEnum(ContentItemKind) kind!: ContentItemKind
  @IsString() @MinLength(1) labelEs!: string
  @IsString() @MinLength(1) labelEn!: string

  @IsOptional() @IsString() icon?: string
  @IsOptional() @IsString() imageUrl?: string | null
  @IsOptional() @IsString() bodyEs?: string
  @IsOptional() @IsString() bodyEn?: string
  @IsOptional() @IsString() value?: string
  @IsOptional() @IsBoolean() published?: boolean
}

export class UpdateContentItemDto {
  @IsOptional() @IsString() @MinLength(1) labelEs?: string
  @IsOptional() @IsString() @MinLength(1) labelEn?: string
  @IsOptional() @IsString() icon?: string
  @IsOptional() @IsString() imageUrl?: string | null
  @IsOptional() @IsString() bodyEs?: string
  @IsOptional() @IsString() bodyEn?: string
  @IsOptional() @IsString() value?: string
  @IsOptional() @IsBoolean() published?: boolean
}

export class CreateReviewDto {
  @IsString() @MinLength(1) authorName!: string
  @IsString() @MinLength(1) textEs!: string
  @IsString() @MinLength(1) textEn!: string

  @IsOptional() @IsString() authorPhotoUrl?: string | null
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) rating?: number
  @IsOptional() @IsString() stayedAtEs?: string
  @IsOptional() @IsString() stayedAtEn?: string
  @IsOptional() @IsBoolean() verified?: boolean
  @IsOptional() @IsBoolean() featured?: boolean
  @IsOptional() @IsBoolean() published?: boolean
}

export class UpdateReviewDto {
  @IsOptional() @IsString() @MinLength(1) authorName?: string
  @IsOptional() @IsString() @MinLength(1) textEs?: string
  @IsOptional() @IsString() @MinLength(1) textEn?: string
  @IsOptional() @IsString() authorPhotoUrl?: string | null
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) rating?: number
  @IsOptional() @IsString() stayedAtEs?: string
  @IsOptional() @IsString() stayedAtEn?: string
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
