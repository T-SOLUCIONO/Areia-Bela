import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { CustomersService } from './customers.service'
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto'

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

  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.customers.remove(id)
  }
}
