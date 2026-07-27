import { Module } from '@nestjs/common'
import { CmsController } from './cms.controller'
import { CmsService } from './cms.service'
import { StorageService } from './storage.service'
import { TranslationService } from './translation.service'

@Module({
  controllers: [CmsController],
  providers: [CmsService, StorageService, TranslationService],
  exports: [CmsService],
})
export class CmsModule {}
