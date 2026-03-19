import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { resolve } from 'path'

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env',                                      // cwd (works when cwd is repo root)
        '../../.env',                                 // cwd = apps/backend (npm workspace)
        resolve(__dirname, '../../../../.env'),        // relative to compiled dist/
      ],
      expandVariables: true
    })
  ]
})
export class ConfigModule {}
