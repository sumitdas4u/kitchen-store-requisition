import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '../common/constants'
import { QueueService } from './queue.service'
import { CreateStockEntryProcessor } from './processors/create-stock-entry.processor'
import { CreateStockReconciliationProcessor } from './processors/create-stock-reconciliation.processor'
import { SendWhatsAppProcessor } from './processors/send-whatsapp.processor'
import { SyncItemsProcessor } from './processors/sync-items.processor'
import { ErpWriteProcessor } from './processors/erp-write.processor'
import { ErpModule } from '../erp/erp.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { QueueController } from './queue.controller'
import { Requisition } from '../database/entities/requisition.entity'
import { RequisitionItem } from '../database/entities/requisition-item.entity'
import { WarehouseItemGroup } from '../database/entities/warehouse-item-group.entity'

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.ErpWrite },
      { name: QUEUE_NAMES.CreateStockEntry },
      { name: QUEUE_NAMES.CreateStockReconciliation },
      { name: QUEUE_NAMES.SendWhatsApp },
      { name: QUEUE_NAMES.SyncItems }
    ),
    ErpModule,
    TypeOrmModule.forFeature([Requisition, RequisitionItem, WarehouseItemGroup]),
    forwardRef(() => NotificationsModule)
  ],
  controllers: [QueueController],
  providers: [
    QueueService,
    CreateStockEntryProcessor,
    CreateStockReconciliationProcessor,
    SendWhatsAppProcessor,
    SyncItemsProcessor,
    ErpWriteProcessor
  ],
  exports: [QueueService]
})
export class QueueModule {}
