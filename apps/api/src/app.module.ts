import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { PropertiesModule } from './properties/properties.module'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, PropertiesModule],
})
export class AppModule {}
