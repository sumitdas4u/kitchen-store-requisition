import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { BullModule } from '@nestjs/bullmq'
import { ScheduleModule } from '@nestjs/schedule'
import { ConfigModule } from './config/config.module'
import { AuthModule } from './auth/auth.module'
import { RequisitionModule } from './requisition/requisition.module'
import { KitchenModule } from './kitchen/kitchen.module'
import { StoreModule } from './store/store.module'
import { AdminModule } from './admin/admin.module'
import { ErpModule } from './erp/erp.module'
import { NotificationsModule } from './notifications/notifications.module'
import { QueueModule } from './queue/queue.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { RolesGuard } from './common/guards/roles.guard'
import { ConfigService } from '@nestjs/config'
import { DatabaseModule } from './database/database.module'

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: Number(configService.get<string>('REDIS_PORT'))
        }
      })
    }),
    AuthModule,
    ErpModule,
    RequisitionModule,
    KitchenModule,
    StoreModule,
    AdminModule,
    NotificationsModule,
    QueueModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard }
  ]
})
export class AppModule {}
