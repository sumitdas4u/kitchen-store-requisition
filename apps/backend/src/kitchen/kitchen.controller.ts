import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '../common/enums'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { KitchenService } from './kitchen.service'
import { RequisitionService } from '../requisition/requisition.service'
import { CreateRequisitionDto } from '../requisition/dto/create-requisition.dto'

@Controller('kitchen')
@Roles(Role.Kitchen)
export class KitchenController {
  constructor(
    private readonly kitchenService: KitchenService,
    private readonly requisitionService: RequisitionService
  ) {}

  @Get('items')
  async getItems(
    @CurrentUser() user: { default_warehouse?: string | null; company?: string },
    @Query('warehouse') warehouse?: string,
    @Query('company') company?: string
  ) {
    const resolvedWarehouse = user?.default_warehouse || warehouse || null
    const resolvedCompany = user?.company || company || ''
    return this.kitchenService.getItemsForWarehouse(
      resolvedWarehouse,
      resolvedCompany
    )
  }

  @Get('item-groups')
  async getItemGroups(
    @CurrentUser() user: { default_warehouse?: string | null; company?: string },
    @Query('warehouse') warehouse?: string,
    @Query('company') company?: string
  ) {
    const resolvedWarehouse = user?.default_warehouse || warehouse || null
    const resolvedCompany = user?.company || company || ''
    return this.kitchenService.getItemGroupsForWarehouse(
      resolvedWarehouse,
      resolvedCompany
    )
  }

  @Get('stock')
  async getStock(
    @CurrentUser() user: { default_warehouse?: string | null },
    @Query('warehouse') warehouse?: string
  ) {
    const resolvedWarehouse = user?.default_warehouse || warehouse || null
    return this.kitchenService.getStockForWarehouse(resolvedWarehouse)
  }

  @Get('requisitions')
  async listRequisitions(
    @CurrentUser() user: { default_warehouse?: string | null },
    @Query('warehouse') warehouse?: string
  ) {
    const resolvedWarehouse = user?.default_warehouse || warehouse || null
    return this.kitchenService.listRequisitions(resolvedWarehouse)
  }

  @Post('requisition')
  async createRequisition(
    @CurrentUser()
    user: {
      user_id: number
      company: string
      default_warehouse?: string | null
      source_warehouse?: string | null
    } | null,
    @Body() body: CreateRequisitionDto,
    @Query('warehouse') warehouse?: string,
    @Query('source_warehouse') sourceWarehouse?: string,
    @Query('company') company?: string
  ) {
    const resolvedUser = {
      user_id: user?.user_id || 0,
      company: user?.company || company || '',
      default_warehouse: user?.default_warehouse || warehouse || null,
      source_warehouse: user?.source_warehouse || sourceWarehouse || null
    }
    return this.requisitionService.createDraft(resolvedUser, body)
  }
}
