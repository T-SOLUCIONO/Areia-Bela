import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator'
import { ExtraPricingType } from '@prisma/client'

const MONTH_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export class CreateExtraDto {
  @IsString() @MinLength(1) key!: string
  @IsString() @MinLength(1) nameEs!: string
  @IsString() @MinLength(1) nameEn!: string
  @IsEnum(ExtraPricingType) pricingType!: ExtraPricingType
  @Type(() => Number) @IsNumber() @Min(0) price!: number

  @IsOptional() @IsBoolean() refundable?: boolean
  @IsOptional() @IsBoolean() requiresRequest?: boolean
  @IsOptional() @IsBoolean() active?: boolean

  // "MM-DD" — the heated pool is only offered part of the year.
  @IsOptional()
  @Matches(MONTH_DAY, { message: 'seasonStartMonthDay must be MM-DD' })
  seasonStartMonthDay?: string
  @IsOptional()
  @Matches(MONTH_DAY, { message: 'seasonEndMonthDay must be MM-DD' })
  seasonEndMonthDay?: string
}

export class UpdateExtraDto {
  @IsOptional() @IsString() @MinLength(1) nameEs?: string
  @IsOptional() @IsString() @MinLength(1) nameEn?: string
  @IsOptional() @IsEnum(ExtraPricingType) pricingType?: ExtraPricingType
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number
  @IsOptional() @IsBoolean() refundable?: boolean
  @IsOptional() @IsBoolean() requiresRequest?: boolean
  @IsOptional() @IsBoolean() active?: boolean
  @IsOptional() @Matches(MONTH_DAY) seasonStartMonthDay?: string
  @IsOptional() @Matches(MONTH_DAY) seasonEndMonthDay?: string
}
