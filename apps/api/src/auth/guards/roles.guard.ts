import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { UserRole } from '@prisma/client'
import type { Request } from 'express'
import { ROLES_KEY } from '../auth.constants'
import type { AuthenticatedUser } from '../auth.types'

/**
 * Enforces @Roles(...). Runs after JwtAuthGuard, so request.user is populated;
 * a route with @Roles but no authenticated user is treated as forbidden rather
 * than silently allowed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>()
    const user = request.user
    if (!user) {
      throw new ForbiddenException('Insufficient permissions')
    }

    if (!required.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    return true
  }
}
