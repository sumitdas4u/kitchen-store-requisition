import { Module, forwardRef } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { NotificationsGateway } from './notifications.gateway'
import { QueueModule } from '../queue/queue.module'
import { NotificationsController } from './notifications.controller'

@Module({
  imports: [forwardRef(() => QueueModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService]
})
export class NotificationsModule {}
