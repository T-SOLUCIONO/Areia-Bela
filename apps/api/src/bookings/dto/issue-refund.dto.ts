import { IsNumber, IsOptional, IsPositive, IsString, MaxLength, Max } from 'class-validator'

export class IssueRefundDto {
  /**
   * In dollars, as the panel shows it. Two decimals, because a card refund is
   * a real amount of money and not a fraction of a cent.
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  // A stay cannot cost this much; the real ceiling is what is left to refund,
  // checked against the booking in the service.
  @Max(1_000_000)
  amount!: number

  /** Shown to the guest in the email, so it is written for them to read. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string
}
