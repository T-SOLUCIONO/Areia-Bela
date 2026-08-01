import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { GUEST_SESSION_COOKIE } from '@areia-bela/shared'
import { GuestAuthService } from './guest-auth.service'

/**
 * Proves the caller is a signed-in guest, and attaches which one.
 *
 * Deliberately not the staff guard with an extra role: a guest is a Customer,
 * not a User, and the two should never be able to satisfy the same check. The
 * token's audience is what enforces that.
 */
@Injectable()
export class GuestGuard implements CanActivate {
  constructor(private readonly guestAuth: GuestAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { guest?: unknown }>()
    const token = (request.cookies as Record<string, string> | undefined)?.[GUEST_SESSION_COOKIE]
    if (!token) throw new UnauthorizedException('Not signed in')

    request.guest = this.guestAuth.verifySession(token)
    return true
  }
}
