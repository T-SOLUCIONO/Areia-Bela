import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator'
import { UserRole } from '@prisma/client'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole

  @IsOptional()
  @IsBoolean()
  active?: boolean

  // Optional so an admin can reset someone's password without a separate
  // endpoint. Same minimum as creation.
  @IsOptional()
  @IsString()
  @MinLength(12)
  password?: string
}
