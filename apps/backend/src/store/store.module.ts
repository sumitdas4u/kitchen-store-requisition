import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StoreController } from './store.controller'
import { StoreService } from './store.service'
import { ErpModule } from '../erp/erp.module'
import { RequisitionModule } from '../requisition/requisition.module'
import { SupplierListCache } from '../database/entities/supplier-list-cache.entity'
import { ItemCatalogCache } from '../database/entities/item-catalog-cache.entity'
import { VendorItemOverride } from '../database/entities/vendor-item-override.entity'
import { VendorOrder } from '../database/entities/vendor-order.entity'
import { VendorOrderLine } from '../database/entities/vendor-order-line.entity'
import { VendorOrderPo } from '../database/entities/vendor-order-po.entity'
import { VendorReceipt } from '../database/entities/vendor-receipt.entity'
import { VendorReceiptLine } from '../database/entities/vendor-receipt-line.entity'

@Module({
  imports: [
    ErpModule,
    RequisitionModule,
    TypeOrmModule.forFeature([
      SupplierListCache,
      ItemCatalogCache,
      VendorItemOverride,
      VendorOrder,
      VendorOrderLine,
      VendorOrderPo,
      VendorReceipt,
      VendorReceiptLine
    ])
  ],
  controllers: [StoreController],
  providers: [StoreService]
})
export class StoreModule {}
