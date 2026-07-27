import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator'
import { UserRole } from '@prisma/client'

export class CreateUserDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(12)
  password!: string

  @IsString()
  @MinLength(1)
  firstName!: string

  @IsString()
  @MinLength(1)
  lastName!: string

  @IsEnum(UserRole)
  role!: UserRole
}
