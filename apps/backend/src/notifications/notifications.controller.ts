import { Controller, Get } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '../common/enums'

@Controller('notifications')
@Roles(Role.Admin)
export class NotificationsController {
  @Get('health')
  async health() {
    return { ok: true }
  }
}
