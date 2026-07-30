import { Type } from 'class-transformer'
import { SUPPORTED_LOCALES } from '@areia-bela/shared'
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { GuestCountsDto } from '../../properties/dto/quote-request.dto'
/** Who the stay is for. Becomes the Customer row. */
export class GuestDetailsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string
  @IsEmail()
  @MaxLength(160)
  email!: string
  @IsString()
  @MinLength(5)
  @MaxLength(40)
  phone!: string
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  country!: string
}
/**
 * A request to hold the dates.
 *
 * No total. The server prices the stay from these inputs and that figure is
 * what Stripe charges — CLAUDE.md, and the reason `?total=1` no longer buys a
 * week (changelog §21).
 */
export class CreateHoldDto {
  @IsDateString()
  checkIn!: string
  @IsDateString()
  checkOut!: string
  @ValidateNested()
  @Type(() => GuestCountsDto)
  guests!: GuestCountsDto
  @ValidateNested()
  @Type(() => GuestDetailsDto)
  guest!: GuestDetailsDto
  @IsArray()
  @IsString({ each: true })
  extraIds!: string[]
  @IsOptional()
  @IsObject()
  extraUnits?: Record<string, number>
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string
  /** Which of the five site languages the guest is booking in. */
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: string
}
