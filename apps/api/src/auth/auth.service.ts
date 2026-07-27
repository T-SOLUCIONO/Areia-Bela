import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import type { User } from '@prisma/client'
import * as argon2 from 'argon2'
import { createHash, randomBytes } from 'node:crypto'
import {
  ACCESS_TOKEN_TTL_SECONDS,
  ACCOUNT_LOCKOUT_MINUTES,
  INVITATION_TTL_HOURS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  PASSWORD_RESET_TTL_MINUTES,
  RECOVERY_CODE_COUNT,
  REFRESH_TOKEN_TTL_SECONDS,
  TOTP_CHALLENGE_TTL_SECONDS,
} from '@areia-bela/shared'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { passwordResetEmail } from '../mail/templates/password-reset'
import { invitationEmail } from '../mail/templates/invitation'
import { TotpService } from './totp.service'
import {
  TOTP_CHALLENGE_PURPOSE,
  type AccessTokenPayload,
  type TotpChallengePayload,
} from './auth.types'
import { LoginDto } from './dto/login.dto'

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
}

export type PublicUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role'>

export interface AuthResult extends IssuedTokens {
  user: PublicUser
}

/**
 * Login is two-step when the account has TOTP enabled: the first step proves
 * the password and returns a short-lived challenge, and only the second step
 * (a valid code) issues session cookies. `requiresTotp` discriminates them.
 */
export type LoginOutcome =
  ({ requiresTotp: false } & AuthResult) | { requiresTotp: true; challengeToken: string }

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly totpService: TotpService,
    private readonly mailService: MailService,
  ) {}

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id })
  }

  /**
   * Refresh tokens are opaque random strings, stored only as a SHA-256 digest.
   * Argon2 would be wasteful here: the token is already high-entropy, and this
   * runs on every refresh. The digest means a DB leak can't be replayed.
   */
  private static hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  async login(dto: LoginDto): Promise<LoginOutcome> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })

    // Same generic error for unknown email, wrong password and inactive
    // account, so the endpoint can't be used to enumerate valid addresses.
    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials')
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.')
    }

    const passwordMatches = await argon2.verify(user.passwordHash, dto.password)
    if (!passwordMatches) {
      await this.registerFailedAttempt(user)
      throw new UnauthorizedException('Invalid credentials')
    }

    // Password is correct, so the attempt counter resets either way — but with
    // TOTP enabled no session is issued until the second factor is proven.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })

    if (user.totpEnabledAt && user.totpSecret) {
      return { requiresTotp: true, challengeToken: await this.issueTotpChallenge(user) }
    }

    return { requiresTotp: false, ...(await this.completeLogin(user)) }
  }

  /**
   * Second login step. Accepts either a TOTP code or a single-use recovery
   * code, so a lost authenticator device isn't a lockout.
   */
  async verifyTotpChallenge(challengeToken: string, code: string): Promise<AuthResult> {
    let payload: TotpChallengePayload
    try {
      payload = await this.jwtService.verifyAsync<TotpChallengePayload>(challengeToken)
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge')
    }

    if (payload.purpose !== TOTP_CHALLENGE_PURPOSE) {
      throw new UnauthorizedException('Invalid or expired challenge')
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.active || !user.totpEnabledAt || !user.totpSecret) {
      throw new UnauthorizedException('Invalid or expired challenge')
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.')
    }

    const accepted =
      this.totpService.verifyCode(code, user.totpSecret) ||
      (await this.consumeRecoveryCode(user.id, code))

    if (!accepted) {
      // Wrong second factors count toward the same lockout as wrong passwords,
      // otherwise a 6-digit code would be brute-forceable given the challenge.
      await this.registerFailedAttempt(user)
      throw new UnauthorizedException('Invalid verification code')
    }

    return this.completeLogin(user)
  }

  private async completeLogin(user: User): Promise<AuthResult> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    })

    const tokens = await this.issueTokens(user)
    return { ...tokens, user: AuthService.toPublicUser(user) }
  }

  static toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    }
  }

  private issueTotpChallenge(user: User): Promise<string> {
    const payload: TotpChallengePayload = { sub: user.id, purpose: TOTP_CHALLENGE_PURPOSE }
    return this.jwtService.signAsync(payload, { expiresIn: TOTP_CHALLENGE_TTL_SECONDS })
  }

  /** Marks a matching unused recovery code as used. Single-use by design. */
  private async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const codeHash = TotpService.hashRecoveryCode(code)
    const result = await this.prisma.recoveryCode.updateMany({
      where: { userId, codeHash, usedAt: null },
      data: { usedAt: new Date() },
    })
    return result.count > 0
  }

  /**
   * Rotates the refresh token: the presented one is revoked and a new pair is
   * issued. Reusing a revoked token is rejected, which is what makes a stolen
   * token single-use at worst.
   */
  async refresh(presentedToken: string): Promise<AuthResult> {
    const tokenHash = AuthService.hashRefreshToken(presentedToken)
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // A revoked token being presented can mean theft, so drop every session
      // for that user rather than just refusing this one request.
      if (stored?.revokedAt) {
        this.logger.warn(`Revoked refresh token reused for user ${stored.userId}`)
        await this.revokeAllForUser(stored.userId)
      }
      throw new UnauthorizedException('Invalid refresh token')
    }

    if (!stored.user.active) {
      await this.revokeAllForUser(stored.userId)
      throw new UnauthorizedException('Invalid refresh token')
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })

    const tokens = await this.issueTokens(stored.user)
    return {
      ...tokens,
      user: {
        id: stored.user.id,
        email: stored.user.email,
        firstName: stored.user.firstName,
        lastName: stored.user.lastName,
        role: stored.user.role,
      },
    }
  }

  async logout(presentedToken: string | undefined): Promise<void> {
    if (!presentedToken) return
    const tokenHash = AuthService.hashRefreshToken(presentedToken)
    // updateMany, not update: logging out with an already-unknown token is not
    // an error worth surfacing to the caller.
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  /**
   * Step 1 of enabling 2FA: generate and store a secret, but leave it
   * unconfirmed (totpEnabledAt stays null) until the user proves they can
   * produce a code. Otherwise a failed setup would lock them out.
   */
  async beginTotpSetup(
    userId: string,
  ): Promise<{ secret: string; keyUri: string; qrCodeDataUrl: string }> {
    const user = await this.requireActiveUser(userId)
    if (user.totpEnabledAt) {
      throw new BadRequestException('Two-factor authentication is already enabled')
    }

    const secret = this.totpService.generateSecret()
    await this.prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: this.totpService.encryptSecret(secret) },
    })

    const keyUri = this.totpService.buildKeyUri(user.email, secret)
    return { secret, keyUri, qrCodeDataUrl: await this.totpService.buildQrCodeDataUrl(keyUri) }
  }

  /** Step 2: confirm with a live code, then hand over the recovery codes once. */
  async enableTotp(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.requireActiveUser(userId)
    if (user.totpEnabledAt) {
      throw new BadRequestException('Two-factor authentication is already enabled')
    }
    if (!user.totpSecret) {
      throw new BadRequestException('Start the setup before enabling two-factor authentication')
    }
    if (!this.totpService.verifyCode(code, user.totpSecret)) {
      throw new UnauthorizedException('Invalid verification code')
    }

    const { plaintext, hashes } = this.totpService.generateRecoveryCodes(RECOVERY_CODE_COUNT)

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { totpEnabledAt: new Date() },
      }),
      // Replace any codes from a previous enrolment so old printouts die with it.
      this.prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
      this.prisma.recoveryCode.createMany({
        data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
      }),
    ])

    return { recoveryCodes: plaintext }
  }

  /** Requires the password again: turning off a second factor is sensitive. */
  async disableTotp(userId: string, password: string): Promise<void> {
    const user = await this.requireActiveUser(userId)
    if (!(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials')
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: null, totpEnabledAt: null },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
    ])
  }

  /**
   * Self-service password change. Requires the current password even though
   * the caller is already authenticated: an unattended open session should not
   * be enough to take over the account.
   *
   * Returns a fresh token pair because every other session is revoked — if the
   * old password had leaked, changing it has to log the thief out. The caller
   * keeps working with the new cookies.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthResult> {
    const user = await this.requireActiveUser(userId)

    if (!(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Current password is incorrect')
    }

    if (await argon2.verify(user.passwordHash, newPassword)) {
      throw new BadRequestException('The new password must be different from the current one')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await AuthService.hashPassword(newPassword) },
    })

    await this.revokeAllForUser(user.id)

    const tokens = await this.issueTokens(user)
    return { ...tokens, user: AuthService.toPublicUser(user) }
  }

  /**
   * Emails a reset link. Deliberately silent about whether the address exists:
   * the caller always gets the same answer, so this can't be used to discover
   * which emails have accounts.
   *
   * `requestedByAdmin` only changes the wording of the email.
   */
  async sendPasswordResetEmail(email: string, requestedByAdmin = false): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || !user.active) {
      this.logger.log(`Password reset requested for unknown or inactive account: ${email}`)
      return
    }

    const token = await this.issueResetToken(user.id, PASSWORD_RESET_TTL_MINUTES)
    await this.mailService.send(
      passwordResetEmail({
        to: user.email,
        firstName: user.firstName,
        resetUrl: this.buildResetUrl(token),
        requestedByAdmin,
      }),
    )
  }

  /**
   * Invitation email for a freshly created account. Same single-use token as a
   * reset — the invitee sets their own password, so no credential ever travels
   * by email and nobody but them ever knows it. Longer-lived than a reset:
   * people don't always act on an invitation the same hour.
   */
  async sendInvitationEmail(userId: string, invitedByName: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.active) return

    const token = await this.issueResetToken(userId, INVITATION_TTL_HOURS * 60)
    await this.prisma.user.update({
      where: { id: userId },
      data: { invitedAt: new Date() },
    })

    await this.mailService.send(
      invitationEmail({
        to: user.email,
        firstName: user.firstName,
        invitedByName,
        // `invite=1` only swaps the wording on the page; the form, validation
        // and endpoint are identical, so there is no second page to maintain.
        acceptUrl: `${this.buildResetUrl(token)}&invite=1`,
      }),
    )
  }

  /**
   * Mints a single-use token, invalidating any outstanding one for that user
   * so a re-sent email makes the previous link dead.
   */
  private async issueResetToken(userId: string, ttlMinutes: number): Promise<string> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    })

    const token = randomBytes(32).toString('base64url')
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: AuthService.hashResetToken(token),
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      },
    })
    return token
  }

  private buildResetUrl(token: string): string {
    const baseUrl = this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:3000'
    return `${baseUrl}/admin/reset-password?token=${token}`
  }

  /**
   * Consumes a reset token and sets the new password. Every session is revoked:
   * if the account was compromised, resetting has to lock the intruder out.
   *
   * 2FA is deliberately left untouched — recovering a password must not bypass
   * the second factor.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: AuthService.hashResetToken(token) },
      include: { user: true },
    })

    if (!stored || stored.usedAt || stored.expiresAt < new Date() || !stored.user.active) {
      throw new UnauthorizedException('This reset link is invalid or has expired')
    }

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: stored.userId },
        data: {
          passwordHash: await AuthService.hashPassword(newPassword),
          // Marks the invitation as accepted; also how the UI stops showing
          // "invitation pending" for this person.
          passwordSetAt: new Date(),
          // A reset is also the way back in from a lockout.
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
    ])

    await this.revokeAllForUser(stored.userId)
  }

  /** Same reasoning as refresh tokens: high-entropy input, so a digest is enough. */
  private static hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  async countUnusedRecoveryCodes(userId: string): Promise<number> {
    return this.prisma.recoveryCode.count({ where: { userId, usedAt: null } })
  }

  private async requireActiveUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.active) {
      throw new UnauthorizedException('Account is no longer active')
    }
    return user
  }

  private async issueTokens(user: User): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role }
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    })

    const refreshToken = randomBytes(48).toString('base64url')
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: AuthService.hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    })

    return { accessToken, refreshToken }
  }

  private async registerFailedAttempt(user: User): Promise<void> {
    const attempts = user.failedLoginAttempts + 1
    const shouldLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + ACCOUNT_LOCKOUT_MINUTES * 60 * 1000)
          : user.lockedUntil,
      },
    })

    if (shouldLock) {
      this.logger.warn(`Account locked after ${MAX_FAILED_LOGIN_ATTEMPTS} failures: ${user.email}`)
    }
  }

  /** Fails fast at boot rather than signing tokens with a missing secret. */
  static requireJwtSecret(config: ConfigService): string {
    const secret = config.get<string>('JWT_ACCESS_SECRET')
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_ACCESS_SECRET is missing or shorter than 32 characters. See docs/env.md.',
      )
    }
    return secret
  }
}
