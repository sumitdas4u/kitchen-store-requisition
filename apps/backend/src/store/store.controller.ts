import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { Roles } from '../common/decorators/roles.decorator'
import { Role } from '../common/enums'
import { StoreService } from './store.service'
import { RequisitionService } from '../requisition/requisition.service'
import { IssueRequisitionDto } from '../requisition/dto/issue-requisition.dto'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { VendorOverrideDto } from './dto/vendor-override.dto'
import { CreateVendorOrderDto } from './dto/create-vendor-order.dto'
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto'
import { CreateStoreTransferDto } from './dto/create-store-transfer.dto'

@Controller('store')
@Roles(Role.Store)
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly requisitionService: RequisitionService
  ) {}

  @Get('requisitions')
  async listRequisitions() {
    return this.storeService.listRequisitions()
  }

  @Get('requisitions/:id')
  async getRequisition(@Param('id') id: string) {
    return this.storeService.getRequisition(Number(id))
  }

  @Get('stock/:warehouse')
  async getStock(@Param('warehouse') warehouse: string) {
    return this.storeService.getStock(warehouse)
  }

  @Get('stock')
  async getStockByQuery(
    @CurrentUser() user: { source_warehouse?: string | null },
    @Query('warehouse') warehouse?: string
  ) {
    const target = warehouse || user.source_warehouse
    return this.storeService.getStock(target || '')
  }

  @Post('requisition/:id/issue')
  async issueFromStore(
    @Param('id') id: string,
    @Body() body: IssueRequisitionDto
  ) {
    return this.requisitionService.issue(Number(id), body)
  }

  @Get('vendor-order/shortage')
  async listVendorShortage(
    @CurrentUser() user?: { source_warehouse?: string | null }
  ) {
    const warehouse = user?.source_warehouse || ''
    return this.storeService.getShortageItems(warehouse)
  }

  @Get('vendor-order/vendors')
  async listVendors() {
    const [suppliers, overrides] = await Promise.all([
      this.storeService.listSuppliers(),
      this.storeService.listVendorOverrides()
    ])
    return { suppliers, overrides }
  }

  @Get('vendor-order/catalog/status')
  async getCatalogStatus() {
    return this.storeService.getCatalogStatus()
  }

  @Post('vendor-order/catalog/refresh')
  async refreshCatalog() {
    // Fire and forget — returns immediately
    this.storeService.refreshCatalog().catch(() => {})
    return { message: 'Catalog refresh started in background' }
  }

  /** @deprecated use /catalog/refresh */
  @Post('vendor-order/vendors/refresh')
  async refreshVendorMappings() {
    return this.storeService.refreshCatalog()
  }

  @Post('vendor-order/override')
  async saveVendorOverride(@Body() body: VendorOverrideDto) {
    return this.storeService.saveVendorOverride(body)
  }

  @Post('vendor-order/create')
  async createVendorOrder(
    @CurrentUser() user: { user_id: number; company: string; source_warehouse?: string | null },
    @Body() body: CreateVendorOrderDto
  ) {
    return this.storeService.createVendorOrders(user, body)
  }

  @Get('vendor-order/history')
  async listVendorOrderHistory() {
    return this.storeService.listVendorOrderHistory()
  }

  @Post('vendor-order/retry/:id')
  async retryFailedPo(
    @Param('id') id: string,
    @CurrentUser() user: { user_id: number; company: string; source_warehouse?: string | null }
  ) {
    return this.storeService.retryFailedPo(Number(id), user)
  }

  @Delete('vendor-order/po/:id')
  async deleteFailedPo(@Param('id') id: string) {
    return this.storeService.deleteFailedPo(Number(id))
  }

  @Get('vendor-order/items')
  async searchVendorItems(
    @CurrentUser() user?: { source_warehouse?: string | null },
    @Query('q') q?: string,
    @Query('search') search?: string
  ) {
    const warehouse = user?.source_warehouse || ''
    return this.storeService.searchItems(q || search || '', warehouse)
  }

  @Get('purchase-receipts/open-pos')
  async listOpenPurchaseOrders() {
    return this.storeService.listOpenPurchaseOrders()
  }

  @Post('purchase-receipts/create')
  async createPurchaseReceipt(
    @CurrentUser() user: { user_id: number },
    @Body() body: CreatePurchaseReceiptDto
  ) {
    return this.storeService.createPurchaseReceipt(user, body)
  }

  @Post('purchase-receipts/:receiptId/upload')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadReceiptPhotos(
    @Param('receiptId') receiptId: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    return this.storeService.uploadReceiptPhotos(receiptId, files || [])
  }

  // ── Store-initiated transfers ────────────────────────────────────────────────

  @Get('transfer/sent')
  async listSentTransfers(
    @CurrentUser() user: { source_warehouse?: string | null }
  ) {
    const wh = user.source_warehouse || ''
    return this.requisitionService.listSentTransfers(wh)
  }

  @Get('transfer/kitchens')
  async listKitchenWarehouses() {
    return this.requisitionService.listKitchenWarehouses()
  }

  @Post('transfer/create')
  async createStoreTransfer(
    @CurrentUser() user: { user_id: number; company: string; source_warehouse?: string | null },
    @Body() body: CreateStoreTransferDto
  ) {
    if (!user.source_warehouse) {
      return { error: 'Store warehouse not assigned to your account' }
    }
    return this.requisitionService.createAndIssueFromStore(
      { user_id: user.user_id, company: user.company, source_warehouse: user.source_warehouse },
      body
    )
  }
}
