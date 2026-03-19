import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { join } from 'path'
import { User } from './entities/user.entity'
import { UserWarehouse } from './entities/user-warehouse.entity'
import { Requisition } from './entities/requisition.entity'
import { RequisitionItem } from './entities/requisition-item.entity'
import { WarehouseItemGroup } from './entities/warehouse-item-group.entity'
import { WarehouseItem } from './entities/warehouse-item.entity'
import { AppSettings } from './entities/app-settings.entity'
import { SupplierListCache } from './entities/supplier-list-cache.entity'
import { ItemCatalogCache } from './entities/item-catalog-cache.entity'
import { VendorItemOverride } from './entities/vendor-item-override.entity'
import { VendorOrder } from './entities/vendor-order.entity'
import { VendorOrderLine } from './entities/vendor-order-line.entity'
import { VendorOrderPo } from './entities/vendor-order-po.entity'
import { VendorReceipt } from './entities/vendor-receipt.entity'
import { VendorReceiptLine } from './entities/vendor-receipt-line.entity'
import { PriceChangeLog } from './entities/price-change-log.entity'
import { StockEntryLineCache } from './entities/stock-entry-line-cache.entity'
import { PurchasePriceCache } from './entities/purchase-price-cache.entity'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [
          User,
          UserWarehouse,
          Requisition,
          RequisitionItem,
          WarehouseItemGroup,
          WarehouseItem,
          AppSettings,
          SupplierListCache,
          ItemCatalogCache,
          VendorItemOverride,
          VendorOrder,
          VendorOrderLine,
          VendorOrderPo,
          VendorReceipt,
          VendorReceiptLine,
          PriceChangeLog,
          StockEntryLineCache,
          PurchasePriceCache
        ],
        migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
        migrationsRun: true,
        synchronize: false,
        ssl: false
      })
    })
  ]
})
export class DatabaseModule {}
