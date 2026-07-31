import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { SUPPORTED_LOCALES } from '@areia-bela/shared'

export class RequestLinkDto {
  @IsEmail()
  @MaxLength(160)
  email!: string

  /** So the email arrives in the language the guest is browsing in. */
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: string
}

export class RedeemLinkDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string
}

/** What a guest may change about themselves. Not their email: that is the
 * identifier their bookings and their sign-in link hang off. */
export class UpdateMyDetailsDto {
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
  @IsString()
  @MaxLength(40)
  phone?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string
}
