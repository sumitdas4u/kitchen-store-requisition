import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '../common/enums'
import { SyncEntity, SyncService } from './sync.service'

@Controller('admin/sync')
@Roles(Role.Admin)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status')
  async getStatus() {
    return this.syncService.getStatus()
  }

  @Get('log')
  async getLog(@Query('limit') limit?: string) {
    return this.syncService.getSyncLog(limit ? parseInt(limit) : 50)
  }

  @Post('trigger')
  async trigger(
    @Body() body: { entity: SyncEntity; warehouse?: string }
  ) {
    return this.syncService.triggerSync(body.entity, body.warehouse)
  }
}
