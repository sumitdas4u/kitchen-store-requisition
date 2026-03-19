import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ErpService } from './erp.service'
import { ErpController } from './erp.controller'
import { AppSettings } from '../database/entities/app-settings.entity'

@Module({
  imports: [TypeOrmModule.forFeature([AppSettings])],
  controllers: [ErpController],
  providers: [ErpService],
  exports: [ErpService]
})
export class ErpModule {}
