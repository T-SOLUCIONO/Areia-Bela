import { Module } from '@nestjs/common'
import { TaxesController } from './taxes.controller'
import { TaxesService } from './taxes.service'

/** Reporting only. Nothing here changes what a guest is charged. */
@Module({
  controllers: [TaxesController],
  providers: [TaxesService],
})
export class TaxesModule {}
