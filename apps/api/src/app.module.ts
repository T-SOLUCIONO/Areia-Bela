import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './prisma/prisma.module'
import { MailModule } from './mail/mail.module'
import { PropertiesModule } from './properties/properties.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { CmsModule } from './cms/cms.module'
import { NotificationsModule } from './notifications/notifications.module'
import { BookingsModule } from './bookings/bookings.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Baseline limit for every endpoint; the auth routes tighten it further
    // with their own @Throttle decorators.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    MailModule,
    PropertiesModule,
    AuthModule,
    UsersModule,
    CmsModule,
    NotificationsModule,
    BookingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
