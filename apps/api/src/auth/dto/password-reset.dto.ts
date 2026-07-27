import { IsEmail, IsString, MinLength } from 'class-validator'
import { MIN_PASSWORD_LENGTH } from '@areia-bela/shared'

export class ForgotPasswordDto {
  @IsEmail()
  email!: string
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  newPassword!: string
}
