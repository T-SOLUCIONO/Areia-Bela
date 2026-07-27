import { IsString, MinLength } from 'class-validator'

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string

  // Same floor as user creation, so a self-service change can't weaken an
  // account below what an admin is allowed to set.
  @IsString()
  @MinLength(12)
  newPassword!: string
}
