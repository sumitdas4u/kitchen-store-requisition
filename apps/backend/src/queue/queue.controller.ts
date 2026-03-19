import { Controller, Get } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '../common/enums'

@Controller('queue')
@Roles(Role.Admin)
export class QueueController {
  @Get('health')
  async health() {
    return { ok: true }
  }
}
