import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { KitchenController } from './kitchen.controller'
import { KitchenService } from './kitchen.service'
import { ErpModule } from '../erp/erp.module'
import { RequisitionModule } from '../requisition/requisition.module'
import { WarehouseItemGroup } from '../database/entities/warehouse-item-group.entity'
import { WarehouseItem } from '../database/entities/warehouse-item.entity'

@Module({
  imports: [
    ErpModule,
    RequisitionModule,
    TypeOrmModule.forFeature([WarehouseItemGroup, WarehouseItem])
  ],
  controllers: [KitchenController],
  providers: [KitchenService]
})
export class KitchenModule {}
