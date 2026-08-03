import {
  IsDateString,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateFilingDto {
  @IsString() jurisdictionId!: string

  @IsISO8601() periodStart!: string
  @IsISO8601() periodEnd!: string

  /**
   * What was actually remitted. Not taken from the report on purpose: the
   * figure that matters is the one that left the bank, and it can differ from
   * the computed one by a rounding rule the authority applies.
   */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000) amount!: number

  @IsDateString() filedAt!: string

  @IsOptional() @IsString() @MaxLength(120) reference?: string
  @IsOptional() @IsString() @MaxLength(500) notes?: string
}
