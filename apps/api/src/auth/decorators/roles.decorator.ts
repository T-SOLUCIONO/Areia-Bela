import { SetMetadata } from '@nestjs/common'
import type { UserRole } from '@prisma/client'
import { ROLES_KEY } from '../auth.constants'

/** Restricts a route to the given roles. Enforced by RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)
