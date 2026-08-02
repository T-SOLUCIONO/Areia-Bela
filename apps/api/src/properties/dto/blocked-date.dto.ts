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

/**
 * What a block can be corrected to after the fact.
 *
 * The dates are deliberately absent: moving a block is not an edit, it is a
 * different block, and it has to be checked against bookings all over again.
 * Fixing a typo in the reason should not need that.
 */
export class UpdateBlockedDateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string
}
