import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { ACCESS_TOKEN_COOKIE } from '@areia-bela/shared'
import type { Request } from 'express'
import { IS_PUBLIC_KEY } from '../auth.constants'
import type { AccessTokenPayload, AuthenticatedUser } from '../auth.types'

/**
 * Registered globally in AuthModule, so every route requires a valid access
 * token unless it opts out with @Public(). Fails closed by default.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    const token = this.extractToken(request)
    if (!token) {
      throw new UnauthorizedException('Missing access token')
    }

    let payload: AccessTokenPayload & { purpose?: string; aud?: string }
    try {
      payload = await this.jwtService.verifyAsync<
        AccessTokenPayload & { purpose?: string; aud?: string }
      >(token)
    } catch {
      throw new UnauthorizedException('Invalid or expired access token')
    }

    // The half-finished-login challenge token is signed with the same key, so
    // reject anything carrying a purpose claim: only access tokens get through.
    if (payload.purpose) {
      throw new UnauthorizedException('Invalid or expired access token')
    }

    // Same reasoning for guest sessions, which are also signed with this key.
    // `verifyAsync` only checks `aud` when an audience is expected, so without
    // this a guest could present their own token as a Bearer header and be
    // taken for staff — with `role: undefined`, but authenticated. Staff
    // tokens carry no audience at all, so any `aud` here is not one of ours.
    if (payload.aud) {
      throw new UnauthorizedException('Invalid or expired access token')
    }

    request.user = { id: payload.sub, email: payload.email, role: payload.role }
    return true
  }

  /**
   * Cookie first (how the admin UI authenticates), Bearer header as a
   * fallback so the API stays usable from curl and future non-browser clients.
   */
  private extractToken(request: Request): string | undefined {
    const fromCookie = (request.cookies as Record<string, string> | undefined)?.[
      ACCESS_TOKEN_COOKIE
    ]
    if (fromCookie) return fromCookie

    const authorization = request.headers.authorization
    if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length)

    return undefined
  }
}
