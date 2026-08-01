import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { CustomersService } from './customers.service'
import { CreateCustomerDto, ResendLinkDto, UpdateCustomerDto } from './dto/customer.dto'

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  /** Reading who has stayed is fine for any role; nobody edits from here. */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @Get()
  list() {
    return this.customers.list()
  }

  /** Adding by hand: a booking taken over the phone, a guest of the family. */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto)
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto)
  }

  /**
   * Sends the guest their sign-in link again.
   *
   * The host cannot see the link and never holds it: it is generated here and
   * goes straight to the guest's own address. That is the point — this is a
   * "I'll resend it" button for the phone call, not a way into someone's
   * account.
   *
   * Answers 404 for a guest with no bookings, because there is nothing for
   * them to sign in and look at. The public endpoint stays silent about that;
   * this one is behind a session, so being useful beats being coy.
   */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @HttpCode(204)
  @Post(':id/send-login-link')
  async resendLink(@Param('id') id: string, @Body() dto: ResendLinkDto) {
    await this.customers.resendLoginLink(id, dto.locale ?? 'es')
  }

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.customers.remove(id)
  }
}
