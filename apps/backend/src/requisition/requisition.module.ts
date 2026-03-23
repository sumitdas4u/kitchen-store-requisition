import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RequisitionController } from './requisition.controller'
import { RequisitionService } from './requisition.service'
import { QueueModule } from '../queue/queue.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ErpModule } from '../erp/erp.module'
import { UsersModule } from '../users/users.module'
import { Requisition } from '../database/entities/requisition.entity'
import { RequisitionItem } from '../database/entities/requisition-item.entity'
import { ErpWarehouseCache } from '../database/entities/erp-warehouse-cache.entity'

@Module({
  imports: [
    QueueModule,
    NotificationsModule,
    ErpModule,
    UsersModule,
    TypeOrmModule.forFeature([Requisition, RequisitionItem, ErpWarehouseCache])
  ],
  controllers: [RequisitionController],
  providers: [RequisitionService],
  exports: [RequisitionService]
})
export class RequisitionModule {}
