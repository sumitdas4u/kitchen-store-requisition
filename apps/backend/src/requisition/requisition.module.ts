import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RequisitionController } from './requisition.controller'
import { RequisitionService } from './requisition.service'
import { QueueModule } from '../queue/queue.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ErpModule } from '../erp/erp.module'
import { Requisition } from '../database/entities/requisition.entity'
import { RequisitionItem } from '../database/entities/requisition-item.entity'

@Module({
  imports: [
    QueueModule,
    NotificationsModule,
    ErpModule,
    TypeOrmModule.forFeature([Requisition, RequisitionItem])
  ],
  controllers: [RequisitionController],
  providers: [RequisitionService],
  exports: [RequisitionService]
})
export class RequisitionModule {}
