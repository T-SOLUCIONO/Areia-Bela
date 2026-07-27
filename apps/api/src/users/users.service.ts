import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { UserRole, type User } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuthService } from '../auth/auth.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

/** Never expose passwordHash or totpSecret to callers. */
const PUBLIC_FIELDS = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  totpEnabledAt: true,
} as const

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      select: PUBLIC_FIELDS,
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    })
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_FIELDS })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) {
      throw new ConflictException('A user with that email already exists')
    }

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await AuthService.hashPassword(dto.password),
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      },
      select: PUBLIC_FIELDS,
    })
  }

  async update(id: string, dto: UpdateUserDto, actingUserId: string) {
    const target = await this.prisma.user.findUnique({ where: { id } })
    if (!target) throw new NotFoundException('User not found')

    await this.assertNotLockingEveryoneOut(target, dto, actingUserId)

    const passwordHash = dto.password ? await AuthService.hashPassword(dto.password) : undefined

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        active: dto.active,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: PUBLIC_FIELDS,
    })

    // Any of these invalidate existing sessions: a deactivated or demoted user
    // must not keep browsing on an access token issued before the change, and
    // a password change should log other devices out.
    const revokes = dto.active === false || dto.role !== undefined || dto.password !== undefined
    if (revokes) {
      await this.authService.revokeAllForUser(id)
    }

    return user
  }

  /** Soft delete: deactivate rather than lose the audit trail of who did what. */
  async deactivate(id: string, actingUserId: string) {
    const target = await this.prisma.user.findUnique({ where: { id } })
    if (!target) throw new NotFoundException('User not found')

    await this.assertNotLockingEveryoneOut(target, { active: false }, actingUserId)

    const user = await this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: PUBLIC_FIELDS,
    })
    await this.authService.revokeAllForUser(id)
    return user
  }

  /**
   * Guards against the two ways an admin can lose access to the panel with no
   * way back in through the UI: locking themselves out, or removing the last
   * active superadmin.
   */
  private async assertNotLockingEveryoneOut(
    target: User,
    changes: Pick<UpdateUserDto, 'active' | 'role'>,
    actingUserId: string,
  ): Promise<void> {
    const deactivating = changes.active === false
    const demoting = changes.role !== undefined && changes.role !== UserRole.SUPERADMIN

    if (target.id === actingUserId && (deactivating || demoting)) {
      throw new BadRequestException('You cannot deactivate or demote your own account')
    }

    if (target.role !== UserRole.SUPERADMIN || !target.active) return
    if (!deactivating && !demoting) return

    const otherActiveSuperadmins = await this.prisma.user.count({
      where: { role: UserRole.SUPERADMIN, active: true, id: { not: target.id } },
    })

    if (otherActiveSuperadmins === 0) {
      throw new BadRequestException(
        'This is the last active superadmin. Promote another user first.',
      )
    }
  }
}
