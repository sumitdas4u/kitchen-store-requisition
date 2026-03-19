import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '../database/entities/user.entity'
import { UserWarehouse } from '../database/entities/user-warehouse.entity'
import { UsersService } from './users.service'

@Module({
  imports: [TypeOrmModule.forFeature([User, UserWarehouse])],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}
