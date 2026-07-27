import { IsEmail, IsString, MinLength } from 'class-validator'

export class LoginDto {
  @IsEmail()
  email!: string

  // No MaxLength: Argon2 handles long input, and capping it would leak
  // policy detail. MinLength stays low so old accounts can still sign in.
  @IsString()
  @MinLength(1)
  password!: string
}
