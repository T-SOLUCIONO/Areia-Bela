import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator'
import { UserRole } from '@prisma/client'

/**
 * No password field on purpose: creating a member sends them an invitation
 * link and they choose their own. That way no credential travels by email and
 * the admin who invited them never knows it.
 */
export class CreateUserDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(1)
  firstName!: string

  @IsString()
  @MinLength(1)
  lastName!: string

  @IsEnum(UserRole)
  role!: UserRole
}
