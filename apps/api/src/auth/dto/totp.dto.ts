import { IsString, Matches, MinLength } from 'class-validator'

/** Enabling 2FA, and the second login step when an authenticator app is used. */
export class TotpCodeDto {
  // Allows spaces/dashes so pasting from an authenticator works; the service
  // normalizes before verifying.
  @IsString()
  @Matches(/^[\d\s-]{6,8}$/, { message: 'code must be a 6-digit number' })
  code!: string
}

/** Second login step. Accepts a TOTP code or a recovery code. */
export class VerifyTotpDto {
  @IsString()
  @MinLength(1)
  challengeToken!: string

  @IsString()
  @MinLength(6)
  code!: string
}

export class DisableTotpDto {
  @IsString()
  @MinLength(1)
  password!: string
}
