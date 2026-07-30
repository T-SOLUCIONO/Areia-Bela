import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateBlockedDateDto {
  @IsDateString()
  startDate!: string

  /**
   * Inclusive, unlike a booking's checkOut. Blocking "the 3rd to the 5th"
   * means the house is unavailable on the 5th too — nobody arrives that
   * morning because the host is painting the kitchen.
   */
  @IsDateString()
  endDate!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string
}
