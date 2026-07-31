import { Module } from '@nestjs/common'
import { GuestModule } from '../guest/guest.module'
import { CustomersController } from './customers.controller'
import { CustomersService } from './customers.service'

@Module({
  imports: [GuestModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
