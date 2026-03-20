import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { ErpModule } from '../erp/erp.module'
import { QueueModule } from '../queue/queue.module'
import { RequisitionModule } from '../requisition/requisition.module'
import { UsersModule } from '../users/users.module'
import { WarehouseItemGroup } from '../database/entities/warehouse-item-group.entity'
import { WarehouseItem } from '../database/entities/warehouse-item.entity'
import { AppSettings } from '../database/entities/app-settings.entity'
import { Requisition } from '../database/entities/requisition.entity'
import { PriceChangeLog } from '../database/entities/price-change-log.entity'
import { StockEntryLineCache } from '../database/entities/stock-entry-line-cache.entity'
import { PurchasePriceCache } from '../database/entities/purchase-price-cache.entity'
import { ErpItemCache } from '../database/entities/erp-item-cache.entity'
import { ErpBinStockCache } from '../database/entities/erp-bin-stock-cache.entity'

@Module({
  imports: [
    ErpModule,
    QueueModule,
    RequisitionModule,
    UsersModule,
    TypeOrmModule.forFeature([
      WarehouseItemGroup,
      WarehouseItem,
      AppSettings,
      Requisition,
      PriceChangeLog,
      StockEntryLineCache,
      PurchasePriceCache,
      ErpItemCache,
      ErpBinStockCache
    ])
  ],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
