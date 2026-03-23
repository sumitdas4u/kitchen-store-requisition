import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StoreController } from './store.controller'
import { StoreService } from './store.service'
import { ErpModule } from '../erp/erp.module'
import { RequisitionModule } from '../requisition/requisition.module'
import { UsersModule } from '../users/users.module'
import { SupplierListCache } from '../database/entities/supplier-list-cache.entity'
import { ItemCatalogCache } from '../database/entities/item-catalog-cache.entity'
import { VendorItemOverride } from '../database/entities/vendor-item-override.entity'
import { VendorOrder } from '../database/entities/vendor-order.entity'
import { VendorOrderLine } from '../database/entities/vendor-order-line.entity'
import { VendorOrderLineSource } from '../database/entities/vendor-order-line-source.entity'
import { VendorOrderPo } from '../database/entities/vendor-order-po.entity'
import { VendorReceipt } from '../database/entities/vendor-receipt.entity'
import { VendorReceiptLine } from '../database/entities/vendor-receipt-line.entity'
import { ErpBinStockCache } from '../database/entities/erp-bin-stock-cache.entity'
import { ErpWarehouseCache } from '../database/entities/erp-warehouse-cache.entity'

@Module({
  imports: [
    ErpModule,
    RequisitionModule,
    UsersModule,
    TypeOrmModule.forFeature([
      SupplierListCache,
      ItemCatalogCache,
      VendorItemOverride,
      VendorOrder,
      VendorOrderLine,
      VendorOrderLineSource,
      VendorOrderPo,
      VendorReceipt,
      VendorReceiptLine,
      ErpBinStockCache,
      ErpWarehouseCache
    ])
  ],
  controllers: [StoreController],
  providers: [StoreService]
})
export class StoreModule {}
