import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { RequisitionStatus, Role, StockEntrySyncStatus } from '../common/enums'
import { QueueService } from '../queue/queue.service'
import { NotificationsService } from '../notifications/notifications.service'
import { ErpService } from '../erp/erp.service'
import { CreateRequisitionDto } from './dto/create-requisition.dto'
import { IssueRequisitionDto } from './dto/issue-requisition.dto'
import { ConfirmRequisitionDto } from './dto/confirm-requisition.dto'
import { Requisition } from '../database/entities/requisition.entity'
import { RequisitionItem } from '../database/entities/requisition-item.entity'
import { ErpBinStockCache } from '../database/entities/erp-bin-stock-cache.entity'
import { ErpWarehouseCache } from '../database/entities/erp-warehouse-cache.entity'
import {
  assertRequisitionActionAllowed,
  assertRequisitionTransition,
  deriveIssuedItemStatus,
  deriveReceivedItemStatus,
  deriveStatusAfterConfirm,
  deriveStatusAfterIssue,
  RequisitionTransitionAction
} from './requisition-state-machine'

@Injectable()
export class RequisitionService {
  private readonly logger = new Logger(RequisitionService.name)

  constructor(
    @InjectRepository(Requisition)
    private readonly requisitionsRepo: Repository<Requisition>,
    @InjectRepository(RequisitionItem)
    private readonly requisitionItemsRepo: Repository<RequisitionItem>,
    @InjectRepository(ErpBinStockCache)
    private readonly binStockCacheRepo: Repository<ErpBinStockCache>,
    @InjectRepository(ErpWarehouseCache)
    private readonly warehouseCacheRepo: Repository<ErpWarehouseCache>,
    private readonly queueService: QueueService,
    private readonly notificationsService: NotificationsService,
    private readonly erpService: ErpService
  ) {}

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async resolveCompanyFromWarehouses(
    fallbackCompany: string | null | undefined,
    ...warehouses: Array<string | null | undefined>
  ) {
    const uniqueWarehouses = Array.from(
      new Set(
        warehouses
          .map((warehouse) => warehouse?.trim())
          .filter((warehouse): warehouse is string => Boolean(warehouse))
      )
    )

    if (uniqueWarehouses.length > 0) {
      const warehouseRows = await this.warehouseCacheRepo.find({
        where: { name: In(uniqueWarehouses) }
      })
      const companies = Array.from(
        new Set(
          warehouseRows
            .map((row) => row.company?.trim())
            .filter((company): company is string => Boolean(company))
        )
      )

      if (companies.length > 1) {
        throw new BadRequestException(
          'Selected warehouses belong to different companies in ERP'
        )
      }
      if (companies[0]) {
        return companies[0]
      }
    }

    if (fallbackCompany?.trim()) {
      return fallbackCompany.trim()
    }

    throw new BadRequestException('Company is required')
  }

  private async getEffectiveRequisitionCompany(requisition: Requisition) {
    const company = await this.resolveCompanyFromWarehouses(
      requisition.company,
      requisition.source_warehouse,
      requisition.warehouse
    )

    if (company !== requisition.company) {
      requisition.company = company
      await this.requisitionsRepo.save(requisition)
    }

    return company
  }

  private transitionStatus(
    requisition: Requisition,
    action: RequisitionTransitionAction,
    nextStatus: RequisitionStatus,
    errorMessage?: string
  ) {
    const previousStatus = requisition.status
    const previousCompletedAt = requisition.completed_at

    assertRequisitionTransition(
      previousStatus,
      nextStatus,
      action,
      errorMessage
    )

    requisition.status = nextStatus
    if (nextStatus === RequisitionStatus.Completed) {
      requisition.completed_at = requisition.completed_at ?? new Date()
    } else {
      requisition.completed_at = null
    }

    return {
      changed: previousStatus !== nextStatus,
      shouldPersist:
        previousStatus !== nextStatus ||
        previousCompletedAt !== requisition.completed_at
    }
  }

  private async notifyIfStatusChanged(
    requisitionId: number,
    changed: boolean,
    status: RequisitionStatus
  ) {
    if (!changed) {
      return
    }

    await this.notificationsService.notifyStatusChange(
      String(requisitionId),
      status
    )
  }

  private getStoreVisibleItems(items: RequisitionItem[]) {
    return items
      .filter((item) => Number(item.requested_qty || 0) > 0)
      .map((item) => ({ ...item }))
  }

  private toStoreVisibleRequisition(requisition: Requisition): Requisition {
    return {
      ...requisition,
      items: this.getStoreVisibleItems(requisition.items || [])
    }
  }

  private extractErpError(error: any, fallback = 'ERP sync failed') {
    const raw = error?.response?.data
    return (
      raw?.exception ||
      raw?.message ||
      (typeof raw === 'string' ? raw : null) ||
      error?.message ||
      fallback
    )
  }

  private async getWarehouseStockMap(warehouse: string) {
    const stockMap = new Map<string, number>()
    if (!warehouse) {
      return stockMap
    }

    try {
      const rows = await this.erpService.getBinStock(warehouse)
      rows.forEach((row) => {
        stockMap.set(row.item_code, Number(row.actual_qty || 0))
      })
      return stockMap
    } catch (error) {
      this.logger.warn(
        `Falling back to cached stock for ${warehouse}: ${this.extractErpError(error)}`
      )
    }

    const cachedRows = await this.binStockCacheRepo.find({ where: { warehouse } })
    cachedRows.forEach((row) => {
      stockMap.set(row.item_code, Number(row.actual_qty || 0))
    })
    return stockMap
  }

  private assertPositiveQty(value: number, itemCode: string, fieldName: string) {
    if (value < 0) {
      throw new BadRequestException(
        `${fieldName} must be 0 or greater for ${itemCode}`
      )
    }
  }

  private async assertSufficientSourceStock(
    warehouse: string,
    requestedByItem: Map<string, number>
  ) {
    if (requestedByItem.size === 0) {
      return
    }

    const stockMap = await this.getWarehouseStockMap(warehouse)
    requestedByItem.forEach((requestedQty, itemCode) => {
      const availableQty = Number(stockMap.get(itemCode) || 0)
      if (requestedQty > availableQty) {
        throw new BadRequestException(
          `Cannot issue ${requestedQty} of ${itemCode}. Only ${availableQty} available in ${warehouse}`
        )
      }
    })
  }

  private buildIssuedDeltaMap(
    items: Array<{ item_code: string; issued_qty: number }>
  ) {
    const requestedByItem = new Map<string, number>()

    items.forEach((item) => {
      const issuedQty = Number(item.issued_qty || 0)
      this.assertPositiveQty(issuedQty, item.item_code, 'issued_qty')
      if (issuedQty <= 0) {
        return
      }

      requestedByItem.set(
        item.item_code,
        Number(requestedByItem.get(item.item_code) || 0) + issuedQty
      )
    })

    return requestedByItem
  }

  private buildTransferQtyMap(
    items: Array<{ item_code: string; qty: number }>
  ) {
    const requestedByItem = new Map<string, number>()

    items.forEach((item) => {
      const qty = Number(item.qty || 0)
      if (qty <= 0) {
        throw new BadRequestException(
          `qty must be greater than 0 for ${item.item_code}`
        )
      }

      requestedByItem.set(
        item.item_code,
        Number(requestedByItem.get(item.item_code) || 0) + qty
      )
    })

    return requestedByItem
  }

  private setStockEntrySyncState(
    requisition: Requisition,
    status: StockEntrySyncStatus,
    errorMessage: string | null = null
  ) {
    requisition.stock_entry_status = status
    requisition.stock_entry_error_message = errorMessage
    requisition.stock_entry_last_attempt_at = new Date()
  }

  private buildStockEntryPayload(
    requisition: Requisition,
    items: Array<{
      item_code: string
      item_name?: string | null
      qty: number
      uom?: string | null
    }>
  ) {
    const mrItemMap = new Map(
      requisition.items
        .filter((item) => item.erp_mr_item_name)
        .map((item) => [item.item_code, item.erp_mr_item_name!])
    )

    return {
      doctype: 'Stock Entry',
      stock_entry_type: 'Material Transfer',
      company: requisition.company,
      docstatus: 0,
      from_warehouse: requisition.source_warehouse,
      to_warehouse: requisition.warehouse,
      remarks: `KR-${requisition.id} | ${requisition.warehouse} | ${requisition.requested_date}`,
      items: items.map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name ?? null,
        qty: Number(item.qty),
        uom: item.uom ?? null,
        stock_uom: item.uom ?? null,
        s_warehouse: requisition.source_warehouse,
        t_warehouse: requisition.warehouse,
        conversion_factor: 1,
        ...(requisition.erp_name ? { material_request: requisition.erp_name } : {}),
        ...(mrItemMap.get(item.item_code)
          ? { material_request_item: mrItemMap.get(item.item_code) }
          : {})
      }))
    }
  }

  private getRetryableStockEntryItems(requisition: Requisition) {
    return requisition.items
      .filter((item) => Number(item.received_qty) > 0 || Number(item.issued_qty) > 0)
      .map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        qty:
          Number(item.received_qty) > 0
            ? Number(item.received_qty)
            : Number(item.issued_qty),
        uom: item.uom
      }))
  }

  /**
   * Completion keeps the existing ERP behavior:
   * - submit an already-created Stock Entry draft
   * - otherwise enqueue the existing fallback draft-creation flow
   */
  private async enqueueCompletionSync(requisition: Requisition) {
    if (requisition.stock_entry) {
      this.setStockEntrySyncState(
        requisition,
        StockEntrySyncStatus.SubmitPending,
        null
      )
      await this.requisitionsRepo.save(requisition)
      await this.queueService.enqueueErpWrite('submit_stock_entry', {
        action: 'submit_stock_entry',
        payload: {
          name: requisition.stock_entry,
          requisition_id: requisition.id
        }
      })
      return
    }

    const hasActivity = requisition.items.some(
      (item) => Number(item.received_qty) > 0 || Number(item.issued_qty) > 0
    )
    if (hasActivity) {
      this.setStockEntrySyncState(
        requisition,
        StockEntrySyncStatus.DraftPending,
        null
      )
      await this.requisitionsRepo.save(requisition)
      await this.queueService.enqueueCreateStockEntry({
        requisitionId: String(requisition.id)
      })
    }
  }

  private buildItems(dto: CreateRequisitionDto) {
    const items = dto.items
      .map((item) => {
        const orderQty = Number(item.order_qty || 0)
        const actualClosing =
          item.actual_closing === undefined || item.actual_closing === null
            ? null
            : Number(item.actual_closing)
        if (orderQty < 0) {
          throw new BadRequestException(
            `Order Qty must be 0 or greater for ${item.item_code}`
          )
        }
        if (actualClosing !== null && actualClosing < 0) {
          throw new BadRequestException(
            `Actual Closing must be 0 or greater for ${item.item_code}`
          )
        }
        return {
          item_code: item.item_code,
          item_name: item.item_name,
          uom: item.uom,
          closing_stock: item.closing_stock,
          required_qty: 0,
          requested_qty: orderQty,
          actual_closing: actualClosing,
          issued_qty: 0,
          received_qty: 0,
          item_status: 'Pending'
        }
      })
      .filter(
        (item) =>
          Number(item.requested_qty) > 0 || item.actual_closing !== null
      )

    if (items.length === 0) {
      throw new BadRequestException('Add at least one order or actual closing')
    }

    return items as RequisitionItem[]
  }

  /**
   * Build the ERPNext Material Request payload from a requisition.
   * Only items with requested_qty > 0 go into the MR (actual_closing-only
   * items are handled separately via Stock Reconciliation).
   */
  private async buildMaterialRequestPayload(requisition: Requisition) {
    const company = await this.getEffectiveRequisitionCompany(requisition)
    const mrItems = requisition.items
      .filter((item) => Number(item.requested_qty) > 0)
      .map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name ?? undefined,
        qty: Number(item.requested_qty),
        uom: item.uom ?? undefined,
        stock_uom: item.uom ?? undefined,
        warehouse: requisition.source_warehouse,
        schedule_date: requisition.requested_date,
        conversion_factor: 1
      }))

    return {
      doctype: 'Material Request',
      material_request_type: 'Material Transfer',
      company,
      transaction_date: requisition.requested_date,
      schedule_date: requisition.requested_date,
      set_warehouse: requisition.warehouse,
      custom_shift: requisition.shift ?? undefined,
      custom_local_id: String(requisition.id),
      custom_store_note: requisition.notes ?? undefined,
      items: mrItems
    }
  }

  /**
   * Enqueue MR creation in ERPNext (async, non-blocking).
   * If ERPNext is down the queue will retry automatically.
   */
  private async enqueueMaterialRequestCreate(requisition: Requisition) {
    const mrItems = requisition.items.filter((item) => Number(item.requested_qty) > 0)
    if (mrItems.length === 0) return // nothing to push to ERPNext

    const mrPayload = await this.buildMaterialRequestPayload(requisition)
    await this.queueService.enqueueErpWrite('create_material_request', {
      action: 'create_material_request',
      payload: {
        requisition_id: requisition.id,
        mr_payload: mrPayload
      }
    })
  }

  /**
   * Enqueue MR update in ERPNext (async, non-blocking).
   */
  private async enqueueMaterialRequestUpdate(requisition: Requisition) {
    if (!requisition.erp_name) return // no MR created yet, nothing to update

    const mrPayload = await this.buildMaterialRequestPayload(requisition)
    await this.queueService.enqueueErpWrite('update_material_request', {
      action: 'update_material_request',
      payload: {
        requisition_id: requisition.id,
        erp_name: requisition.erp_name,
        mr_payload: mrPayload
      }
    })
  }

  /**
   * Enqueue MR submit in ERPNext (async, non-blocking).
   */
  private async enqueueMaterialRequestSubmit(requisition: Requisition) {
    if (!requisition.erp_name) {
      // MR not yet created â€” create + submit in one go
      // First create, the processor will set erp_name, then we submit
      const mrItems = requisition.items.filter((item) => Number(item.requested_qty) > 0)
      if (mrItems.length === 0) return

      const mrPayload = await this.buildMaterialRequestPayload(requisition)
      // Try synchronous creation so we can submit immediately
      try {
        const erpName = await this.erpService.createMaterialRequestDraft(mrPayload)
        requisition.erp_name = erpName
        requisition.erp_synced = true
        requisition.last_synced_at = new Date()
        await this.requisitionsRepo.save(requisition)

        // Now submit
        await this.queueService.enqueueErpWrite('submit_material_request', {
          action: 'submit_material_request',
          payload: {
            requisition_id: requisition.id,
            erp_name: erpName
          }
        })
      } catch (err: any) {
        this.logger.warn(`Failed to create MR for requisition ${requisition.id}: ${err.message}`)
        // Mark as not synced â€” will be picked up by periodic sync
        requisition.erp_synced = false
        await this.requisitionsRepo.save(requisition)
      }
      return
    }

    await this.queueService.enqueueErpWrite('submit_material_request', {
      action: 'submit_material_request',
      payload: {
        requisition_id: requisition.id,
        erp_name: requisition.erp_name
      }
    })
  }

  // â”€â”€ CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async createDraft(
    user: {
      user_id: number
      company: string
      default_warehouse?: string | null
      source_warehouse?: string | null
    },
    dto: CreateRequisitionDto
  ): Promise<Requisition> {
    if (!user.default_warehouse || !user.source_warehouse) {
      throw new UnauthorizedException('Warehouse not assigned')
    }

    const company = await this.resolveCompanyFromWarehouses(
      user.company,
      user.source_warehouse,
      user.default_warehouse
    )
    const items = this.buildItems(dto)

    const requisition = this.requisitionsRepo.create({
      user_id: user.user_id,
      warehouse: user.default_warehouse,
      source_warehouse: user.source_warehouse,
      company,
      requested_date: dto.requested_date,
      shift: dto.shift,
      notes: dto.notes ?? null,
      status: RequisitionStatus.Draft,
      erp_synced: false,
      items: items as RequisitionItem[]
    })

    const saved = await this.requisitionsRepo.save(requisition)

    // Async: create Material Request draft in ERPNext
    await this.enqueueMaterialRequestCreate(saved)

    return saved
  }

  async updateDraft(requisitionId: number, dto: CreateRequisitionDto) {
    const requisition = await this.getOne(requisitionId)
    if (requisition.status !== RequisitionStatus.Draft) {
      throw new BadRequestException('Only draft requisitions can be edited')
    }
    const items = this.buildItems(dto)
    await this.requisitionItemsRepo.delete({ requisition_id: requisitionId })
    requisition.items = items
    requisition.requested_date = dto.requested_date
    requisition.shift = dto.shift
    requisition.notes = dto.notes ?? null
    requisition.erp_synced = false
    const saved = await this.requisitionsRepo.save(requisition)

    // Async: update or create MR in ERPNext
    if (saved.erp_name) {
      await this.enqueueMaterialRequestUpdate(saved)
    } else {
      await this.enqueueMaterialRequestCreate(saved)
    }

    return saved
  }

  async deleteDraft(requisitionId: number) {
    const requisition = await this.getOne(requisitionId)
    if (requisition.status !== RequisitionStatus.Draft) {
      throw new BadRequestException('Only draft requisitions can be deleted')
    }

    // Cancel MR in ERPNext if it exists
    if (requisition.erp_name) {
      await this.queueService.enqueueErpWrite('cancel_material_request', {
        action: 'cancel_material_request',
        payload: { erp_name: requisition.erp_name }
      })
    }

    await this.requisitionItemsRepo.delete({ requisition_id: requisitionId })
    await this.requisitionsRepo.delete({ id: requisitionId })
    return { ok: true }
  }

  async submit(requisitionId: number) {
    const requisition = await this.getOne(requisitionId)
    this.transitionStatus(
      requisition,
      'submit',
      RequisitionStatus.Submitted,
      'Only draft requisitions can be submitted'
    )
    requisition.submitted_at = new Date()
    requisition.erp_synced = false
    await this.requisitionsRepo.save(requisition)

    await this.notificationsService.notifyStatusChange(
      String(requisitionId),
      RequisitionStatus.Submitted
    )

    // Async: submit MR in ERPNext (creates if needed, then submits)
    await this.enqueueMaterialRequestSubmit(requisition)

    // Stock reconciliation for actual closing differences
    const needsReconcile = requisition.items.some(
      (item) =>
        item.actual_closing !== null &&
        Number(item.actual_closing) !== Number(item.closing_stock)
    )
    if (needsReconcile) {
      await this.queueService.enqueueCreateStockReconciliation({
        requisitionId: String(requisitionId)
      })
    }

    return { ok: true, status: requisition.status }
  }

  // â”€â”€ Read â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async list(role: Role, warehouse?: string | null) {
    if (role === Role.Kitchen && warehouse) {
      return this.listByWarehouse(warehouse)
    }
    if (role === Role.Store) {
      return this.listForStore()
    }
    return this.requisitionsRepo.find({ relations: ['items'] })
  }

  async listByWarehouse(warehouse: string) {
    return this.requisitionsRepo.find({
      where: { warehouse },
      relations: ['items'],
      order: { requested_date: 'DESC' }
    })
  }

  async listForStore() {
    const results = await this.requisitionsRepo.find({
      where: [
        { status: RequisitionStatus.Submitted },
        { status: RequisitionStatus.PartiallyIssued }
      ],
      relations: ['items'],
      order: { requested_date: 'DESC' }
    })
    return results
      .map((req) => this.toStoreVisibleRequisition(req))
      .filter(
        (req) =>
          req.items.length > 0 &&
          req.items.some(
            (item) =>
              Number(item.requested_qty) > Number(item.received_qty || 0)
          )
      )
  }

  async getOne(requisitionId: number) {
    const requisition = await this.requisitionsRepo.findOne({
      where: { id: requisitionId },
      relations: ['items']
    })
    if (!requisition) {
      throw new BadRequestException('Requisition not found')
    }
    return requisition
  }

  async getOneForStore(requisitionId: number) {
    const requisition = await this.getOne(requisitionId)
    const visible = this.toStoreVisibleRequisition(requisition)
    if (visible.items.length === 0) {
      throw new BadRequestException('Requisition has no requested items for store')
    }
    return visible
  }

  // â”€â”€ Issue (Store) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async issue(requisitionId: number, dto: IssueRequisitionDto) {
    const requisition = await this.getOne(requisitionId)
    assertRequisitionActionAllowed(
      requisition.status,
      'issue',
      'Requisition is not ready to issue'
    )
    const itemMap = new Map(requisition.items.map((item) => [item.item_code, item]))
    const issuedDeltaMap = this.buildIssuedDeltaMap(dto.items || [])
    await this.assertSufficientSourceStock(
      requisition.source_warehouse,
      issuedDeltaMap
    )

    const issuedItems: { item_code: string; item_name: string | null; qty: number; uom: string | null }[] = []

    dto.items.forEach((item) => {
      const existing = itemMap.get(item.item_code)
      if (!existing) {
        throw new BadRequestException(`Item not found: ${item.item_code}`)
      }
      const issuedTotal = Number(existing.issued_qty)
      const issuedDelta = Number(item.issued_qty)
      const nextIssued = issuedTotal + issuedDelta
      if (nextIssued > Number(existing.requested_qty)) {
        throw new BadRequestException(
          `issued_qty cannot exceed order_qty for ${item.item_code}`
        )
      }
      existing.issued_qty = nextIssued
      existing.item_status = deriveIssuedItemStatus(existing)

      if (issuedDelta > 0) {
        issuedItems.push({
          item_code: existing.item_code,
          item_name: existing.item_name,
          qty: issuedDelta,
          uom: existing.uom
        })
      }
    })

    const requestedItems = requisition.items.filter(
      (item) => Number(item.requested_qty) > 0
    )
    if (requestedItems.length === 0) {
      throw new BadRequestException('Requisition has no requested items to issue')
    }

    const newStatus = deriveStatusAfterIssue(requisition.items)
    const { changed } = this.transitionStatus(
      requisition,
      'issue',
      newStatus,
      'Requisition is not ready to issue'
    )
    requisition.issued_at = new Date()
    requisition.erp_synced = false
    if (dto.store_note !== undefined) {
      requisition.store_note = dto.store_note
    }
    await this.requisitionsRepo.save(requisition)
    await this.requisitionItemsRepo.save(requisition.items)

    // Create Stock Entry (Material Transfer) in ERPNext for the issued items
    // Link each SE item to the Material Request via material_request + material_request_item
    if (issuedItems.length > 0) {
      // Build a map of item_code â†’ erp_mr_item_name for linking
      const mrItemMap = new Map(
        requisition.items
          .filter((i) => i.erp_mr_item_name)
          .map((i) => [i.item_code, i.erp_mr_item_name!])
      )

      const company = await this.getEffectiveRequisitionCompany(requisition)
      requisition.company = company
      const sePayload = {
        doctype: 'Stock Entry',
        stock_entry_type: 'Material Transfer',
        company,
        docstatus: 0,
        from_warehouse: requisition.source_warehouse,
        to_warehouse: requisition.warehouse,
        remarks: `KR-${requisition.id} | ${requisition.warehouse} | ${requisition.requested_date}`,
        items: issuedItems.map((item) => ({
          item_code: item.item_code,
          item_name: item.item_name ?? null,
          qty: item.qty,
          uom: item.uom ?? null,
          stock_uom: item.uom ?? null,
          s_warehouse: requisition.source_warehouse,
          t_warehouse: requisition.warehouse,
          conversion_factor: 1,
          // Link to Material Request at item level
          ...(requisition.erp_name ? { material_request: requisition.erp_name } : {}),
          ...(mrItemMap.get(item.item_code) ? { material_request_item: mrItemMap.get(item.item_code) } : {})
        }))
      }

      try {
        const seName = await this.erpService.createStockEntryDraft(sePayload)
        requisition.stock_entry = seName
        this.setStockEntrySyncState(
          requisition,
          StockEntrySyncStatus.DraftCreated,
          null
        )
        requisition.erp_synced = true
        requisition.last_synced_at = new Date()
        await this.requisitionsRepo.save(requisition)
      } catch (err: any) {
        const errorMessage = this.extractErpError(
          err,
          'Failed to create Stock Entry draft'
        )
        this.setStockEntrySyncState(
          requisition,
          StockEntrySyncStatus.Failed,
          errorMessage
        )
        requisition.erp_synced = false
        await this.requisitionsRepo.save(requisition)
        this.logger.warn(
          `Failed to create Stock Entry for requisition ${requisitionId}: ${errorMessage}`
        )
      }
    }

    await this.notifyIfStatusChanged(requisitionId, changed, newStatus)
    return { ok: true, status: newStatus }
  }

  // â”€â”€ Confirm (Kitchen) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async confirm(requisitionId: number, dto: ConfirmRequisitionDto) {
    const requisition = await this.getOne(requisitionId)
    assertRequisitionActionAllowed(
      requisition.status,
      'confirm',
      'Requisition is not ready to confirm'
    )
    const itemMap = new Map(requisition.items.map((item) => [item.item_code, item]))

    dto.items.forEach((item) => {
      const existing = itemMap.get(item.item_code)
      if (!existing) {
        throw new BadRequestException(`Item not found: ${item.item_code}`)
      }
      const requestedQty = Number(existing.requested_qty || 0)
      const issuedQty = Number(existing.issued_qty || 0)
      const currentReceived = Number(existing.received_qty || 0)

      if (item.received_qty > issuedQty) {
        throw new BadRequestException(
          `received_qty cannot exceed issued_qty for ${item.item_code}`
        )
      }
      if (item.received_qty < 0) {
        throw new BadRequestException(
          `received_qty must be 0 or greater for ${item.item_code}`
        )
      }
      if (item.received_qty > requestedQty) {
        throw new BadRequestException(
          `received_qty cannot exceed requested_qty for ${item.item_code}`
        )
      }
      const desired =
        item.action === 'accept'
          ? Math.min(issuedQty, requestedQty)
          : item.action === 'reject'
          ? currentReceived
          : Number(item.received_qty)

      if (desired > issuedQty || desired > requestedQty) {
        throw new BadRequestException(
          `received_qty cannot exceed requested_qty for ${item.item_code}`
        )
      }

      const nextReceived = Math.max(currentReceived, desired)
      existing.received_qty = nextReceived
      existing.item_status = deriveReceivedItemStatus(existing)
    })

    const requestedItems = requisition.items.filter(
      (item) => Number(item.requested_qty) > 0
    )
    if (requestedItems.length === 0) {
      throw new BadRequestException('Requisition has no requested items to confirm')
    }

    const newStatus = deriveStatusAfterConfirm(requisition.items)
    const { changed } = this.transitionStatus(
      requisition,
      'confirm',
      newStatus,
      'Requisition is not ready to confirm'
    )
    await this.requisitionsRepo.save(requisition)
    await this.requisitionItemsRepo.save(requisition.items)

    if (newStatus === RequisitionStatus.Completed) {
      await this.enqueueCompletionSync(requisition)
    }

    await this.notifyIfStatusChanged(requisitionId, changed, newStatus)

    return { ok: true, status: newStatus }
  }

  // â”€â”€ Finalize (Kitchen) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async finalize(requisitionId: number) {
    const requisition = await this.getOne(requisitionId)
    const { changed, shouldPersist } = this.transitionStatus(
      requisition,
      'finalize',
      RequisitionStatus.Completed,
      'Requisition is not ready to finalize'
    )
    if (shouldPersist) {
      await this.requisitionsRepo.save(requisition)
    }
    if (changed) {
      await this.enqueueCompletionSync(requisition)
    }
    await this.notifyIfStatusChanged(requisitionId, changed, requisition.status)
    return { ok: true, status: requisition.status }
  }

  // â”€â”€ Reject / Cancel / Resolve â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async reject(requisitionId: number, reason?: string) {
    const requisition = await this.getOne(requisitionId)
    this.transitionStatus(
      requisition,
      'reject',
      RequisitionStatus.Rejected,
      'Requisition cannot be rejected in its current status'
    )
    requisition.notes = reason || null
    await this.requisitionsRepo.save(requisition)
    // Cancel the MR in ERPNext if it exists
    if (requisition.erp_name) {
      await this.queueService.enqueueErpWrite('cancel_material_request', {
        action: 'cancel_material_request',
        payload: { erp_name: requisition.erp_name }
      })
    }
    return { ok: true }
  }

  async cancelByKitchen(requisitionId: number, reason?: string) {
    const requisition = await this.getOne(requisitionId)
    this.transitionStatus(
      requisition,
      'cancel',
      RequisitionStatus.Rejected,
      'Only pending requisitions can be cancelled'
    )
    requisition.notes = reason || requisition.notes || null
    await this.requisitionsRepo.save(requisition)
    // Cancel the MR in ERPNext if it exists
    if (requisition.erp_name) {
      await this.queueService.enqueueErpWrite('cancel_material_request', {
        action: 'cancel_material_request',
        payload: { erp_name: requisition.erp_name }
      })
    }
    return { ok: true }
  }

  async resolve(requisitionId: number) {
    const requisition = await this.getOne(requisitionId)
    this.transitionStatus(
      requisition,
      'resolve',
      RequisitionStatus.Completed,
      'Requisition cannot be resolved in its current status'
    )
    await this.requisitionsRepo.save(requisition)
    return { ok: true }
  }

  // â”€â”€ Store-initiated transfer (no kitchen request needed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listSentTransfers(sourceWarehouse: string): Promise<Requisition[]> {
    const results = await this.requisitionsRepo.find({
      where: [
        { source_warehouse: sourceWarehouse, status: RequisitionStatus.Issued },
        { source_warehouse: sourceWarehouse, status: RequisitionStatus.PartiallyIssued },
        { source_warehouse: sourceWarehouse, status: RequisitionStatus.Completed },
      ],
      relations: ['items'],
      order: { created_at: 'DESC' },
    })
    return results
      .map((req) => this.toStoreVisibleRequisition(req))
      .filter((req) => req.items.length > 0)
  }

  async listKitchenWarehouses(): Promise<string[]> {
    const rows = await this.requisitionsRepo
      .createQueryBuilder('r')
      .select('DISTINCT r.warehouse', 'warehouse')
      .orderBy('r.warehouse', 'ASC')
      .getRawMany()
    return rows.map((r) => r.warehouse).filter(Boolean)
  }

  async createAndIssueFromStore(
    user: { user_id: number; company: string; source_warehouse: string },
    dto: { target_warehouse: string; items: { item_code: string; item_name?: string; uom?: string; qty: number }[]; note?: string }
  ) {
    if (!dto.target_warehouse) throw new BadRequestException('Target warehouse required')
    if (!dto.items?.length)    throw new BadRequestException('At least one item required')
    const requestedByItem = this.buildTransferQtyMap(dto.items)
    await this.assertSufficientSourceStock(
      user.source_warehouse,
      requestedByItem
    )

    const today = new Date().toISOString().split('T')[0]
    const company = await this.resolveCompanyFromWarehouses(
      user.company,
      user.source_warehouse,
      dto.target_warehouse
    )

    const req = this.requisitionsRepo.create({
      user_id:          user.user_id,
      warehouse:        dto.target_warehouse,
      source_warehouse: user.source_warehouse,
      company,
      requested_date:   today,
      shift:            'Morning' as any,
      notes:            dto.note ?? null,
      status:           RequisitionStatus.Issued,
      submitted_at:     new Date(),
      issued_at:        new Date(),
      erp_synced:       false,
      items:            dto.items.map((item) =>
        this.requisitionItemsRepo.create({
          item_code:     item.item_code,
          item_name:     item.item_name ?? null,
          uom:           item.uom ?? null,
          closing_stock: 0,
          required_qty:  0,
          requested_qty: Number(item.qty),
          issued_qty:    Number(item.qty),
          received_qty:  0,
          actual_closing: null,
          item_status:   'Issued',
        })
      ),
    })

    const saved = await this.requisitionsRepo.save(req)

    // Create Material Request (submitted) + Stock Entry draft in ERPNext
    // Link SE items to MR via material_request + material_request_item
    let erpDraft: string | null = null
    let erpError: string | null = null
    try {
      // 1. Create and submit Material Request in ERPNext
      const mrPayload = await this.buildMaterialRequestPayload(saved)
      const mrName = await this.erpService.createMaterialRequestDraft(mrPayload)
      saved.erp_name = mrName
      await this.erpService.submitMaterialRequest(mrName)
      await this.requisitionsRepo.save(saved)

      // 2. Fetch MR item row names for linking
      const mrDoc = await this.erpService.getMaterialRequest(mrName)
      const mrItemNameMap = new Map<string, string>()
      if (mrDoc?.items) {
        for (const mrItem of mrDoc.items) {
          if ((mrItem as any).name) {
            mrItemNameMap.set(mrItem.item_code, (mrItem as any).name)
          }
        }
        // Store MR item names locally
        const savedItems = await this.requisitionItemsRepo.find({
          where: { requisition_id: saved.id }
        })
        for (const si of savedItems) {
          const mrItemName = mrItemNameMap.get(si.item_code)
          if (mrItemName) {
            si.erp_mr_item_name = mrItemName
            await this.requisitionItemsRepo.save(si)
          }
        }
      }

      // 3. Create Stock Entry draft with item-level MR linking
      const sePayload = {
        doctype: 'Stock Entry',
        stock_entry_type: 'Material Transfer',
        company,
        docstatus: 0,
        from_warehouse: user.source_warehouse,
        to_warehouse: dto.target_warehouse,
        remarks: `KR-${saved.id} | ${dto.target_warehouse} | ${today}`,
        items: dto.items.map((item) => ({
          item_code: item.item_code,
          item_name: item.item_name ?? null,
          qty: Number(item.qty),
          uom: item.uom ?? null,
          stock_uom: item.uom ?? null,
          s_warehouse: user.source_warehouse,
          t_warehouse: dto.target_warehouse,
          conversion_factor: 1,
          material_request: mrName,
          ...(mrItemNameMap.get(item.item_code) ? { material_request_item: mrItemNameMap.get(item.item_code) } : {})
        }))
      }
      erpDraft = await this.erpService.createStockEntryDraft(sePayload)
      saved.stock_entry = erpDraft
      this.setStockEntrySyncState(
        saved,
        StockEntrySyncStatus.DraftCreated,
        null
      )
      saved.erp_synced = true
      saved.last_synced_at = new Date()
      await this.requisitionsRepo.save(saved)
    } catch (e: any) {
      erpError = this.extractErpError(e, 'ERP draft creation failed')
      this.setStockEntrySyncState(
        saved,
        StockEntrySyncStatus.Failed,
        erpError
      )
      saved.erp_synced = false
      await this.requisitionsRepo.save(saved)
      this.logger.warn(`Store transfer ERP sync failed for KR-${saved.id}: ${erpError}`)
    }

    return {
      ok: true,
      requisition_id: saved.id,
      warehouse: dto.target_warehouse,
      items: dto.items.length,
      erp_draft: erpDraft,
      erp_error: erpError,
      stock_entry_status: saved.stock_entry_status,
      stock_entry_error_message: saved.stock_entry_error_message
    }
  }

  async retryStockEntry(requisitionId: number) {
    const requisition = await this.getOne(requisitionId)
    if (requisition.stock_entry_status !== StockEntrySyncStatus.Failed) {
      throw new BadRequestException('Only failed stock entries can be retried')
    }

    const retryItems = this.getRetryableStockEntryItems(requisition)
    if (retryItems.length === 0) {
      throw new BadRequestException('No issued or received items available for Stock Entry sync')
    }

    try {
      requisition.company = await this.getEffectiveRequisitionCompany(requisition)

      if (requisition.stock_entry) {
        this.setStockEntrySyncState(
          requisition,
          StockEntrySyncStatus.SubmitPending,
          null
        )
        await this.requisitionsRepo.save(requisition)
        await this.erpService.submitStockEntry(requisition.stock_entry)
        this.setStockEntrySyncState(
          requisition,
          StockEntrySyncStatus.Submitted,
          null
        )
      } else {
        const stockEntryName = await this.erpService.createStockEntryDraft(
          this.buildStockEntryPayload(requisition, retryItems)
        )
        requisition.stock_entry = stockEntryName

        if (requisition.status === RequisitionStatus.Completed) {
          await this.erpService.submitStockEntry(stockEntryName)
          this.setStockEntrySyncState(
            requisition,
            StockEntrySyncStatus.Submitted,
            null
          )
        } else {
          this.setStockEntrySyncState(
            requisition,
            StockEntrySyncStatus.DraftCreated,
            null
          )
        }
      }

      requisition.erp_synced = true
      requisition.last_synced_at = new Date()
      await this.requisitionsRepo.save(requisition)

      return {
        success: true,
        stock_entry: requisition.stock_entry,
        stock_entry_status: requisition.stock_entry_status
      }
    } catch (error: any) {
      const errorMessage = this.extractErpError(
        error,
        'Failed to retry Stock Entry sync'
      )
      this.setStockEntrySyncState(
        requisition,
        StockEntrySyncStatus.Failed,
        errorMessage
      )
      requisition.erp_synced = false
      await this.requisitionsRepo.save(requisition)

      return {
        success: false,
        error: errorMessage,
        stock_entry: requisition.stock_entry ?? null,
        stock_entry_status: requisition.stock_entry_status
      }
    }
  }
}
