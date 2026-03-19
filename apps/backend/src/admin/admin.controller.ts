import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '../common/enums'
import { AdminService } from './admin.service'
import { CreateUserDto } from '../users/dto/create-user.dto'
import { UpdateUserDto } from '../users/dto/update-user.dto'
import { CurrentUser } from '../common/decorators/current-user.decorator'

@Controller('admin')
@Roles(Role.Admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboardStats() {
    return this.adminService.getDashboardStats()
  }

  @Get('low-stock')
  async getLowStock(
    @Query('warehouse') warehouse: string,
    @Query('days') days?: string
  ) {
    return this.adminService.getLowStock(warehouse, days ? parseInt(days) : 30)
  }

  @Post('low-stock/sync')
  async syncStockEntries(@Query('warehouse') warehouse: string) {
    return this.adminService.syncStockEntries(warehouse)
  }

  @Get('low-stock/sync-info')
  async getStockEntrySyncInfo(@Query('warehouse') warehouse: string) {
    return this.adminService.getStockEntrySyncInfo(warehouse)
  }

  @Get('reports/consumption')
  async reportConsumption(
    @Query('from') from: string,
    @Query('to') to: string
  ) {
    return this.adminService.reportConsumption(from, to)
  }

  @Get('reports/aging')
  async reportAging(
    @Query('from') from: string,
    @Query('to') to: string
  ) {
    return this.adminService.reportAging(from, to)
  }

  @Get('reports/wastage')
  async reportWastage(
    @Query('from') from: string,
    @Query('to') to: string
  ) {
    return this.adminService.reportWastage(from, to)
  }

  @Get('reports/vendor-performance')
  async reportVendorPerformance() {
    return this.adminService.reportVendorPerformance()
  }

  @Get('reports/cost-summary')
  async reportCostSummary(
    @Query('from') from: string,
    @Query('to') to: string
  ) {
    return this.adminService.reportCostSummary(from, to)
  }

  @Get('prices/lists')
  async getPriceLists() {
    return this.adminService.getPriceLists()
  }

  @Get('prices/history')
  async getPriceHistory(@Query('item_code') itemCode?: string) {
    return this.adminService.getPriceHistory(itemCode)
  }

  @Get('prices/vendor-history')
  async getVendorPriceHistory(@Query('search') search?: string) {
    return this.adminService.getVendorPriceHistory(search)
  }

  @Post('prices/sync')
  async syncPurchasePrices() {
    return this.adminService.syncPurchasePrices()
  }

  @Get('prices/sync-info')
  async getPurchasePriceSyncInfo() {
    return this.adminService.getPurchasePriceSyncInfo()
  }

  @Get('prices')
  async listPrices(@Query('price_list') priceList: string) {
    return this.adminService.listPrices(priceList)
  }

  @Put('prices/:item_code')
  async updatePrice(
    @Param('item_code') itemCode: string,
    @Body() body: { price_list: string; rate: number; item_name?: string },
    @CurrentUser() user: { user_id: number; username: string }
  ) {
    return this.adminService.updatePrice(
      itemCode,
      body.price_list,
      body.rate,
      user.user_id,
      user.username,
      body.item_name
    )
  }

  @Get('users')
  async listUsers() {
    return this.adminService.listUsers()
  }

  @Post('users')
  async createUser(@Body() body: CreateUserDto) {
    return this.adminService.createUser(body)
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.adminService.getUser(Number(id))
  }

  @Put('users/:id')
  async updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.adminService.updateUser(Number(id), body)
  }

  @Delete('users/:id')
  async deactivateUser(@Param('id') id: string) {
    return this.adminService.deactivateUser(Number(id))
  }

  @Get('warehouse-groups/:warehouse')
  async listWarehouseGroups(@Param('warehouse') warehouse: string) {
    return this.adminService.listWarehouseGroups(warehouse)
  }

  @Post('warehouse-groups')
  async addWarehouseGroup(
    @Body()
    body: { warehouse: string; item_group: string; company: string }
  ) {
    return this.adminService.addWarehouseGroup(body)
  }

  @Delete('warehouse-groups/:id')
  async removeWarehouseGroup(@Param('id') id: string) {
    return this.adminService.removeWarehouseGroup(Number(id))
  }

  @Get('warehouse-items/:warehouse')
  async listWarehouseItems(@Param('warehouse') warehouse: string) {
    return this.adminService.listWarehouseItems(warehouse)
  }

  @Post('warehouse-items')
  async addWarehouseItem(
    @Body()
    body: { warehouse: string; item_code: string; company: string }
  ) {
    return this.adminService.addWarehouseItem(body)
  }

  @Delete('warehouse-items/:id')
  async removeWarehouseItem(@Param('id') id: string) {
    return this.adminService.removeWarehouseItem(Number(id))
  }

  @Get('stock-entries')
  async listStockEntries() {
    return this.adminService.listStockEntries()
  }

  @Post('stock-entries/:name/submit')
  async submitStockEntry(@Param('name') name: string) {
    return this.adminService.submitStockEntry(name)
  }

  @Get('stock-reconciliations')
  async listStockReconciliations() {
    return this.adminService.listStockReconciliations()
  }

  @Post('stock-reconciliations/:name/submit')
  async submitStockReconciliation(@Param('name') name: string) {
    return this.adminService.submitStockReconciliation(name)
  }

  @Get('requisitions/summary')
  async getRequisitionSummary() {
    return this.adminService.getRequisitionSummary()
  }

  @Get('requisitions/enhanced')
  async listRequisitionsEnhanced(
    @Query('status') status?: string,
    @Query('shift') shift?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('kitchen') kitchen?: string
  ) {
    return this.adminService.listRequisitionsEnhanced({ status, shift, date_from, date_to, kitchen })
  }

  @Get('requisitions')
  async listRequisitions(
    @Query('status') status?: string,
    @Query('warehouse') warehouse?: string
  ) {
    return this.adminService.listRequisitions({ status, warehouse })
  }

  @Put('requisitions/:id/resolve')
  async resolve(@Param('id') id: string) {
    return this.adminService.resolveRequisition(id)
  }

  @Get('settings')
  async getSettings() {
    return this.adminService.getSettings()
  }

  @Put('settings')
  async updateSettings(@Body() body: { erp_base_url?: string }) {
    return this.adminService.updateSettings(body)
  }

  @Post('settings/test')
  async testSettings() {
    return this.adminService.testSettings()
  }
}
