import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SyncController } from './sync.controller'
import { SyncService } from './sync.service'
import { ErpModule } from '../erp/erp.module'
import { ErpItemCache } from '../database/entities/erp-item-cache.entity'
import { ErpItemGroupCache } from '../database/entities/erp-item-group-cache.entity'
import { ErpWarehouseCache } from '../database/entities/erp-warehouse-cache.entity'
import { ErpCompanyCache } from '../database/entities/erp-company-cache.entity'
import { ErpBinStockCache } from '../database/entities/erp-bin-stock-cache.entity'
import { SupplierListCache } from '../database/entities/supplier-list-cache.entity'
import { SyncLog } from '../database/entities/sync-log.entity'

@Module({
  imports: [
    ErpModule,
    TypeOrmModule.forFeature([
      ErpItemCache,
      ErpItemGroupCache,
      ErpWarehouseCache,
      ErpCompanyCache,
      ErpBinStockCache,
      SupplierListCache,
      SyncLog
    ])
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService]
})
export class SyncModule {}
