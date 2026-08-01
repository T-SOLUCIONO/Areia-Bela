import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { SUPPORTED_LOCALES } from '@areia-bela/shared'

export class CreateCustomerDto {
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
  @MaxLength(40)
  phone!: string

  @IsString()
  @MaxLength(80)
  country!: string

  /** The host's own note. Never shown to the guest. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string
}

export class ResendLinkDto {
  /** The language the guest booked in, so the email matches it. */
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: string
}
