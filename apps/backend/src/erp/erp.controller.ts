import { Controller, Get, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '../common/enums'
import { ErpService } from './erp.service'

@Controller('admin/erp')
@Roles(Role.Admin)
export class ErpController {
  constructor(private readonly erpService: ErpService) {}

  @Get('companies')
  async getCompanies() {
    return this.erpService.getCompanies()
  }

  @Get('warehouses')
  async getWarehouses(@Query('company') company?: string) {
    return this.erpService.getWarehouses(company)
  }

  @Get('item-groups')
  async getItemGroups(@Query('company') company?: string) {
    return this.erpService.getItemGroups(company)
  }

  @Get('items')
  async getItems(@Query('item_groups') itemGroups?: string) {
    const groups = itemGroups ? itemGroups.split(',').map((g) => g.trim()) : []
    return this.erpService.getItemsByGroups(groups.filter(Boolean))
  }
}
