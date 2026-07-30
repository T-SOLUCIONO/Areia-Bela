import { Module } from '@nestjs/common'
import { PropertiesController } from './properties.controller'
import { PropertiesService } from './properties.service'

@Module({
  controllers: [PropertiesController],
  providers: [PropertiesService],
  // BookingsModule prices a stay through the same service, so a guest is never
  // quoted one figure and charged another.
  exports: [PropertiesService],
})
export class PropertiesModule {}
