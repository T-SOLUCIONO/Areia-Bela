import { Type } from 'class-transformer'
import {
  IsArray,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

class UpdateGuestsDto {
  @IsInt()
  @Min(1)
  @Max(8)
  adults!: number

  @IsInt()
  @Min(0)
  @Max(8)
  children!: number

  @IsInt()
  @Min(0)
  @Max(8)
  infants!: number

  @IsInt()
  @Min(0)
  @Max(2)
  @IsOptional()
  pets?: number
}

/**
 * What the host may change about a stay that already exists.
 *
 * Deliberately narrow. Dates, guests and extras are the things a guest phones
 * about; who the guest *is* is not a change, it is a different booking. The
 * total is absent because it is never accepted from a caller — it is recomputed
 * from these fields, like everywhere else in this system.
 *
 * Every field is optional so a host moving only the check-out does not have to
 * resend the party. What is sent replaces; what is omitted stays.
 */
export class UpdateBookingDto {
  @IsISO8601()
  @IsOptional()
  checkIn?: string

  @IsISO8601()
  @IsOptional()
  checkOut?: string

  @ValidateNested()
  @Type(() => UpdateGuestsDto)
  @IsOptional()
  guests?: UpdateGuestsDto

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  extraIds?: string[]

  @IsObject()
  @IsOptional()
  extraUnits?: Record<string, number>

  @IsString()
  @IsOptional()
  specialRequests?: string

  /**
   * Why it moved, in the host's words.
   *
   * Not decoration: it goes into what the guest is told. "Your dates changed"
   * with no reason reads like a mistake, and the guest's next move is to phone
   * and ask.
   */
  @IsString()
  @IsOptional()
  reason?: string
}
