import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole } from '@prisma/client'
import { RolesGuard } from './roles.guard'
import type { AuthenticatedUser } from '../auth.types'

const contextWith = (user?: AuthenticatedUser): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  }) as unknown as ExecutionContext

const user = (role: UserRole): AuthenticatedUser => ({ id: 'u1', email: 'a@b.c', role })

describe('RolesGuard', () => {
  const guardFor = (required?: UserRole[]) => {
    const reflector = { getAllAndOverride: () => required } as unknown as Reflector
    return new RolesGuard(reflector)
  }

  it('allows a route with no @Roles metadata', () => {
    expect(guardFor(undefined).canActivate(contextWith(user(UserRole.VIEWER)))).toBe(true)
  })

  it('allows a route with an empty role list', () => {
    expect(guardFor([]).canActivate(contextWith(user(UserRole.VIEWER)))).toBe(true)
  })

  it('allows a user whose role is listed', () => {
    const guard = guardFor([UserRole.SUPERADMIN, UserRole.MANAGER])
    expect(guard.canActivate(contextWith(user(UserRole.MANAGER)))).toBe(true)
  })

  it('denies a user whose role is not listed', () => {
    const guard = guardFor([UserRole.SUPERADMIN])
    expect(() => guard.canActivate(contextWith(user(UserRole.VIEWER)))).toThrow(ForbiddenException)
  })

  it('denies when the route requires a role but no user was attached', () => {
    // Fails closed: a misordered guard chain must not grant access.
    const guard = guardFor([UserRole.SUPERADMIN])
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(ForbiddenException)
  })

  it.each([UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER])(
    'is exact about role %s, never treating it as a hierarchy',
    (role) => {
      // VIEWER must not inherit MANAGER's access, and MANAGER not SUPERADMIN's.
      const guard = guardFor([role])
      const others = [UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER].filter(
        (candidate) => candidate !== role,
      )
      expect(guard.canActivate(contextWith(user(role)))).toBe(true)
      others.forEach((candidate) =>
        expect(() => guard.canActivate(contextWith(user(candidate)))).toThrow(ForbiddenException),
      )
    },
  )
})
