import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { SeasonType } from '@prisma/client'

export class CreatePriceRuleDto {
  @IsString() @MaxLength(80) name!: string

  @IsEnum(SeasonType) type!: SeasonType

  /** Required for HIGH, refused for the others. Checked in the service. */
  @IsOptional() @IsISO8601() startDate?: string
  @IsOptional() @IsISO8601() endDate?: string

  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(100_000) nightlyRate!: number

  /**
   * How many nights a stay starting in this season must be. Omitted leaves the
   * house-wide minimum in charge.
   */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) minNights?: number

  @IsOptional() @IsBoolean() active?: boolean
}

export class UpdatePriceRuleDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string
  @IsOptional() @IsISO8601() startDate?: string
  @IsOptional() @IsISO8601() endDate?: string
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(100_000) nightlyRate?: number
  /** Null clears it, so the house-wide minimum takes over again. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) minNights?: number | null
  @IsOptional() @IsBoolean() active?: boolean
}
