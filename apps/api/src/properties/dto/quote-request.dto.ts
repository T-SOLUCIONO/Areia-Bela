import { Type } from 'class-transformer'
import {
  IsArray,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'

export class GuestCountsDto {
  @IsInt()
  @Min(1)
  adults!: number

  @IsInt()
  @Min(0)
  children!: number

  /** Never counted towards capacity or price — see docs/domain-decisions.md. */
  @IsInt()
  @Min(0)
  infants!: number

  /** Counted like Airbnb does: in the guest picker, priced as the pet fee. */
  @IsOptional()
  @IsInt()
  @Min(0)
  pets?: number
}

export class QuoteRequestDto {
  @IsDateString()
  checkIn!: string

  @IsDateString()
  checkOut!: string

  /**
   * Optional: a quote for the dates alone is valid, and is what the home page
   * asks for before anyone has picked a party size.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => GuestCountsDto)
  guests?: GuestCountsDto

  @IsArray()
  @IsString({ each: true })
  extraIds!: string[]

  /**
   * Units per extra, keyed by its `key`. Hours for the nanny, animals for the
   * pet fee — without it there is no honest way to price either.
   */
  @IsOptional()
  @IsObject()
  extraUnits?: Record<string, number>
}
