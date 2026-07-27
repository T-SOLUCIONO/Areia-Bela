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
import { CMSPageSlug, FAQCategory } from '@prisma/client'

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
}

export { CMSPageSlug, FAQCategory }
