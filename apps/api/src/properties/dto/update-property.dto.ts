import { CancellationPolicy } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

/**
 * The editable half of the property. Everything is optional so the admin can
 * save one tab without resending the rest.
 *
 * Money and percentages are numbers here and stored as Decimal — pricing is
 * server-authoritative (CLAUDE.md), so these are the figures the quote is
 * computed from, not a suggestion from the client.
 */
export class UpdatePropertyDto {
  @IsOptional() @IsString() @MinLength(1) name?: string
  @IsOptional() @IsString() @MinLength(1) description?: string

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxGuests?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bedrooms?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bathrooms?: number

  // How long a stay may be, and when it starts earning the long-stay discount.
  // Commercial levers the host pulls, not constants of the house.
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) minNights?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxNights?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) weeklyDiscountPercent?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(2) weeklyDiscountNights?: number

  // Airbnb's ladder, because it is the vocabulary guests already know.
  @IsOptional()
  @IsIn(Object.values(CancellationPolicy))
  cancellationPolicy?: CancellationPolicy

  // What every guest needs and nobody asks: where to park, how the door works.
  @IsOptional() @IsString() @MaxLength(2000) accessNotes?: string

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) additionalGuestFeePerNight?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) cleaningFee?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) serviceFeePercent?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) taxesPercent?: number

  @IsOptional() @IsString() @MinLength(1) address?: string
  @IsOptional() @IsString() @MinLength(1) city?: string
  @IsOptional() @IsString() @MinLength(1) state?: string
  @IsOptional() @IsString() @MinLength(1) country?: string

  // "HH:MM", validated so a typo can't produce a check-in time the site can't render.
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'checkInTime must be HH:MM' })
  checkInTime?: string
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'checkOutTime must be HH:MM' })
  checkOutTime?: string

  @IsOptional() @IsArray() @IsString({ each: true }) amenities?: string[]
  @IsOptional() @IsArray() @IsString({ each: true }) trashCollectionDays?: string[]
}
