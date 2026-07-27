import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { UserRole, type User } from '@prisma/client'
import { randomBytes } from 'node:crypto'
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
  invitedAt: true,
  passwordSetAt: true,
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

  /**
   * Creates the account and emails an invitation. The stored hash is random
   * and unguessable, so the account exists but cannot be signed into until the
   * invitee follows the link and picks their own password. Nobody — not even
   * the superadmin who invited them — ever knows that password.
   */
  async create(dto: CreateUserDto, invitedByUserId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) {
      throw new ConflictException('A user with that email already exists')
    }

    const unusablePassword = randomBytes(32).toString('base64url')
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await AuthService.hashPassword(unusablePassword),
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      },
      select: PUBLIC_FIELDS,
    })

    await this.authService.sendInvitationEmail(user.id, await this.displayName(invitedByUserId))

    // Re-read: sendInvitationEmail stamps invitedAt, and the caller needs the
    // row as it now stands so the UI can show "invitation pending".
    return this.findOne(user.id)
  }

  /** Re-sends the invitation to someone who hasn't set a password yet. */
  async resendInvitation(id: string, invitedByUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('User not found')
    if (!user.active) {
      throw new BadRequestException('Reactivate the account before re-sending the invitation')
    }
    if (user.passwordSetAt) {
      throw new BadRequestException(
        'This person already set a password. Send a password reset instead.',
      )
    }

    await this.authService.sendInvitationEmail(user.id, await this.displayName(invitedByUserId))
    return { message: `Invitation re-sent to ${user.email}` }
  }

  async update(id: string, dto: UpdateUserDto, actingUserId: string) {
    const target = await this.prisma.user.findUnique({ where: { id } })
    if (!target) throw new NotFoundException('User not found')

    await this.assertNotLockingEveryoneOut(target, dto, actingUserId)

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        active: dto.active,
      },
      select: PUBLIC_FIELDS,
    })

    // Both invalidate existing sessions: a deactivated or demoted user must
    // not keep browsing on an access token issued before the change.
    const revokes = dto.active === false || dto.role !== undefined
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

  /** Delegates to AuthService so both entry points share one reset flow. */
  async sendPasswordReset(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('User not found')
    if (!user.active) {
      throw new BadRequestException('Reactivate the account before sending a reset link')
    }

    await this.authService.sendPasswordResetEmail(user.email, true)
    return { message: `Reset link sent to ${user.email}` }
  }

  /**
   * The access token deliberately carries no name, so the inviter's is read
   * here rather than widening the JWT payload with more personal data.
   */
  private async displayName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    })
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'An administrator'
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
