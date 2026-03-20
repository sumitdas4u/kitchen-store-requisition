import { Body, Controller, ForbiddenException, Get, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '../common/enums'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { KitchenService } from './kitchen.service'
import { RequisitionService } from '../requisition/requisition.service'
import { UsersService } from '../users/users.service'
import { CreateRequisitionDto } from '../requisition/dto/create-requisition.dto'

@Controller('kitchen')
@Roles(Role.Kitchen)
export class KitchenController {
  constructor(
    private readonly kitchenService: KitchenService,
    private readonly requisitionService: RequisitionService,
    private readonly usersService: UsersService
  ) {}

  private async checkWarehouseAccess(
    userId: number | undefined,
    warehouse: string | null
  ) {
    if (!userId || !warehouse) return
    const hasAccess = await this.usersService.hasWarehouseAccess(
      userId,
      warehouse
    )
    if (!hasAccess) {
      throw new ForbiddenException('Access denied for this warehouse')
    }
  }

  @Get('items')
  async getItems(
    @CurrentUser()
    user: { user_id?: number; default_warehouse?: string | null; company?: string },
    @Query('warehouse') warehouse?: string,
    @Query('company') company?: string
  ) {
    const resolvedWarehouse = warehouse || user?.default_warehouse || null
    if (warehouse && warehouse !== user?.default_warehouse) {
      await this.checkWarehouseAccess(user?.user_id, resolvedWarehouse)
    }
    const resolvedCompany = user?.company || company || ''
    return this.kitchenService.getItemsForWarehouse(
      resolvedWarehouse,
      resolvedCompany
    )
  }

  @Get('item-groups')
  async getItemGroups(
    @CurrentUser()
    user: { user_id?: number; default_warehouse?: string | null; company?: string },
    @Query('warehouse') warehouse?: string,
    @Query('company') company?: string
  ) {
    const resolvedWarehouse = warehouse || user?.default_warehouse || null
    if (warehouse && warehouse !== user?.default_warehouse) {
      await this.checkWarehouseAccess(user?.user_id, resolvedWarehouse)
    }
    const resolvedCompany = user?.company || company || ''
    return this.kitchenService.getItemGroupsForWarehouse(
      resolvedWarehouse,
      resolvedCompany
    )
  }

  @Get('stock')
  async getStock(
    @CurrentUser()
    user: { user_id?: number; default_warehouse?: string | null },
    @Query('warehouse') warehouse?: string
  ) {
    const resolvedWarehouse = warehouse || user?.default_warehouse || null
    if (warehouse && warehouse !== user?.default_warehouse) {
      await this.checkWarehouseAccess(user?.user_id, resolvedWarehouse)
    }
    return this.kitchenService.getStockForWarehouse(resolvedWarehouse)
  }

  @Get('requisitions')
  async listRequisitions(
    @CurrentUser()
    user: { user_id?: number; default_warehouse?: string | null },
    @Query('warehouse') warehouse?: string
  ) {
    const resolvedWarehouse = warehouse || user?.default_warehouse || null
    if (warehouse && warehouse !== user?.default_warehouse) {
      await this.checkWarehouseAccess(user?.user_id, resolvedWarehouse)
    }
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
    const resolvedWarehouse = warehouse || user?.default_warehouse || null
    if (warehouse && warehouse !== user?.default_warehouse) {
      await this.checkWarehouseAccess(user?.user_id, resolvedWarehouse)
    }
    const resolvedUser = {
      user_id: user?.user_id || 0,
      company: user?.company || company || '',
      default_warehouse: resolvedWarehouse,
      source_warehouse: sourceWarehouse || user?.source_warehouse || null
    }
    return this.requisitionService.createDraft(resolvedUser, body)
  }
}
