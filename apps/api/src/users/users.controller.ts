import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import type { AuthenticatedUser } from '../auth/auth.types'

// Staff administration is superadmin-only; managers and viewers have no
// business creating accounts or changing roles.
@Controller('users')
@Roles(UserRole.SUPERADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() current: AuthenticatedUser) {
    return this.usersService.create(dto, current.id)
  }

  /** For someone who was invited but never followed the link. */
  @Post(':id/resend-invitation')
  @HttpCode(202)
  resendInvitation(@Param('id') id: string, @CurrentUser() current: AuthenticatedUser) {
    return this.usersService.resendInvitation(id, current.id)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() current: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, current.id)
  }

  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() current: AuthenticatedUser) {
    return this.usersService.deactivate(id, current.id)
  }

  /**
   * Emails a reset link instead of letting the admin pick the password: this
   * way nobody but the account owner ever knows it.
   */
  @Post(':id/send-password-reset')
  @HttpCode(202)
  sendPasswordReset(@Param('id') id: string) {
    return this.usersService.sendPasswordReset(id)
  }
}
