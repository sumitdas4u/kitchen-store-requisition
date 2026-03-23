import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '../database/entities/user.entity'
import { UserWarehouse } from '../database/entities/user-warehouse.entity'
import { ErpWarehouseCache } from '../database/entities/erp-warehouse-cache.entity'
import { UsersService } from './users.service'

@Module({
  imports: [TypeOrmModule.forFeature([User, UserWarehouse, ErpWarehouseCache])],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
