import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
} from '@areia-bela/shared'
import { AuthService, type IssuedTokens } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { DisableTotpDto, TotpCodeDto, VerifyTotpDto } from './dto/totp.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto'
import { Public } from './decorators/public.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import type { AuthenticatedUser } from './auth.types'
import { PrismaService } from '../prisma/prisma.service'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Tighter than the global limit: login is the endpoint worth guessing at.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto)

    // With 2FA on, no session cookie is set here — the challenge is returned to
    // the client and only the second step authenticates.
    if (result.requiresTotp) {
      return { requiresTotp: true as const, challengeToken: result.challengeToken }
    }

    this.setAuthCookies(res, result)
    return { requiresTotp: false as const, user: result.user }
  }

  /**
   * Second login step. Rate limited harder than the password step: a 6-digit
   * code is guessable if unlimited attempts are allowed.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login/totp')
  @HttpCode(200)
  async loginTotp(@Body() dto: VerifyTotpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyTotpChallenge(dto.challengeToken, dto.code)
    this.setAuthCookies(res, result)
    return { user: result.user }
  }

  /**
   * Always answers 200, whether or not the address has an account: a different
   * response would turn this into an account enumerator.
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.sendPasswordResetEmail(dto.email)
    return { message: 'If that email has an account, a reset link is on its way.' }
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword)
  }

  // Verifies a password, so it is guessable the same way login is.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(
      current.id,
      dto.currentPassword,
      dto.newPassword,
    )
    // Other sessions were revoked; refresh this one's cookies so the caller
    // isn't logged out by their own password change.
    this.setAuthCookies(res, result)
    return { user: result.user }
  }

  @Post('totp/setup')
  @HttpCode(200)
  beginTotpSetup(@CurrentUser() current: AuthenticatedUser) {
    return this.authService.beginTotpSetup(current.id)
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('totp/enable')
  @HttpCode(200)
  enableTotp(@CurrentUser() current: AuthenticatedUser, @Body() dto: TotpCodeDto) {
    return this.authService.enableTotp(current.id, dto.code)
  }

  @Post('totp/disable')
  @HttpCode(204)
  async disableTotp(@CurrentUser() current: AuthenticatedUser, @Body() dto: DisableTotpDto) {
    await this.authService.disableTotp(current.id, dto.password)
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = (req.cookies as Record<string, string> | undefined)?.[REFRESH_TOKEN_COOKIE]
    if (!presented) {
      throw new UnauthorizedException('Missing refresh token')
    }

    try {
      const result = await this.authService.refresh(presented)
      this.setAuthCookies(res, result)
      return { user: result.user }
    } catch (error) {
      // Clear the cookies too, so a browser holding a dead token stops
      // retrying with it on every navigation.
      this.clearAuthCookies(res)
      throw error
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = (req.cookies as Record<string, string> | undefined)?.[REFRESH_TOKEN_COOKIE]
    await this.authService.logout(presented)
    this.clearAuthCookies(res)
  }

  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: current.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        active: true,
        totpEnabledAt: true,
      },
    })

    // The token can outlive a deactivation, so re-check against the database
    // instead of trusting the claims alone.
    if (!user || !user.active) {
      throw new UnauthorizedException('Account is no longer active')
    }

    const { totpEnabledAt, ...rest } = user
    return {
      user: {
        ...rest,
        totpEnabled: totpEnabledAt !== null,
        // Surfaced so the UI can warn when someone is running low.
        recoveryCodesRemaining: totpEnabledAt
          ? await this.authService.countUnusedRecoveryCodes(user.id)
          : 0,
      },
    }
  }

  private get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production'
  }

  private setAuthCookies(res: Response, tokens: IssuedTokens): void {
    // HttpOnly so JS can't read them (XSS), SameSite=lax so top-level
    // navigations still carry them. Cross-site deployments need SameSite=none
    // plus HTTPS — see docs/env.md.
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    })

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    })
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' })
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: REFRESH_COOKIE_PATH })
  }
}
