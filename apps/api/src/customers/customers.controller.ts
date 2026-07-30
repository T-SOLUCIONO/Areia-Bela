import { Controller, Get } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { CustomersService } from './customers.service'

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  /** Reading who has stayed is fine for any role; nobody edits from here. */
  @Roles(UserRole.SUPERADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @Get()
  list() {
    return this.customers.list()
  }
}
