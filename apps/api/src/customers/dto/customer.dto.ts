import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

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
