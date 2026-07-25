import { Type } from 'class-transformer'
import { IsArray, IsDateString, IsInt, IsString, Min, ValidateNested } from 'class-validator'

class GuestCountsDto {
  @IsInt()
  @Min(0)
  adults!: number

  @IsInt()
  @Min(0)
  children!: number

  @IsInt()
  @Min(0)
  infants!: number
}

export class QuoteRequestDto {
  @IsDateString()
  checkIn!: string

  @IsDateString()
  checkOut!: string

  @ValidateNested()
  @Type(() => GuestCountsDto)
  guests!: GuestCountsDto

  @IsArray()
  @IsString({ each: true })
  extraIds!: string[]
}
