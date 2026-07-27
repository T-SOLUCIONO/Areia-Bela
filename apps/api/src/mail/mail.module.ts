import { Global, Module } from '@nestjs/common'
import { MailService } from './mail.service'

// Global like PrismaModule: any feature may need to send mail, and threading
// the import through every module adds noise without adding safety.
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
