import { Module } from '@nestjs/common'
import { CmsModule } from '../cms/cms.module'
import { AssistantController } from './assistant.controller'
import { AssistantService } from './assistant.service'

@Module({
  imports: [CmsModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
