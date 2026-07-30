import { IsOptional, IsString, MaxLength } from 'class-validator'

export class CancelBookingDto {
  /** Goes into the alert the host receives, and stays on the row. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string
}
