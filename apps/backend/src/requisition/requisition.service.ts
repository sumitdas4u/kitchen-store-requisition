import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RequisitionStatus, Role } from '../common/enums'
import { QueueService } from '../queue/queue.service'
import { NotificationsService } from '../notifications/notifications.service'
import { ErpService } from '../erp/erp.service'
import { CreateRequisitionDto } from './dto/create-requisition.dto'
import { IssueRequisitionDto } from './dto/issue-requisition.dto'
import { ConfirmRequisitionDto } from './dto/confirm-requisition.dto'
import { Requisition } from '../database/entities/requisition.entity'
import { RequisitionItem } from '../database/entities/requisition-item.entity'

@Injectable()
export class RequisitionService {
  private readonly logger = new Logger(RequisitionService.name)

  constructor(
    @InjectRepository(Requisition)
    private readonly requisitionsRepo: Repository<Requisition>,
    @InjectRepository(RequisitionItem)
    private readonly requisitionItemsRepo: Repository<RequisitionItem>,
    private readonly queueService: QueueService,
    private readonly notificationsService: NotificationsService,
    private readonly erpService: ErpService
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

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
  private buildMaterialRequestPayload(requisition: Requisition) {
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
      company: requisition.company,
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

    const mrPayload = this.buildMaterialRequestPayload(requisition)
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

    const mrPayload = this.buildMaterialRequestPayload(requisition)
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
      // MR not yet created — create + submit in one go
      // First create, the processor will set erp_name, then we submit
      const mrItems = requisition.items.filter((item) => Number(item.requested_qty) > 0)
      if (mrItems.length === 0) return

      const mrPayload = this.buildMaterialRequestPayload(requisition)
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
        // Mark as not synced — will be picked up by periodic sync
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

  // ── CRUD ───────────────────────────────────────────────────────────────────

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

    const company = user.company
    if (!company) {
      throw new BadRequestException('Company is required')
    }
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
    if (requisition.status !== RequisitionStatus.Draft) {
      throw new BadRequestException('Only draft requisitions can be submitted')
    }
    requisition.status = RequisitionStatus.Submitted
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

  // ── Read ───────────────────────────────────────────────────────────────────

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
    return results.filter((req) =>
      req.items.some((item) => Number(item.requested_qty) > 0) &&
      req.items.some(
        (item) => Number(item.requested_qty) > Number(item.received_qty || 0)
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

  // ── Issue (Store) ──────────────────────────────────────────────────────────

  async issue(requisitionId: number, dto: IssueRequisitionDto) {
    const requisition = await this.getOne(requisitionId)
    if (
      ![
        RequisitionStatus.Submitted,
        RequisitionStatus.PartiallyIssued
      ].includes(requisition.status)
    ) {
      throw new BadRequestException('Requisition is not ready to issue')
    }
    const itemMap = new Map(requisition.items.map((item) => [item.item_code, item]))

    const issuedItems: { item_code: string; item_name: string | null; qty: number; uom: string | null }[] = []

    dto.items.forEach((item) => {
      const existing = itemMap.get(item.item_code)
      if (!existing) {
        throw new BadRequestException(`Item not found: ${item.item_code}`)
      }
      const issuedTotal = Number(existing.issued_qty)
      const issuedDelta = Number(item.issued_qty)
      if (issuedDelta < 0) {
        throw new BadRequestException(
          `issued_qty must be 0 or greater for ${item.item_code}`
        )
      }
      const nextIssued = issuedTotal + issuedDelta
      if (nextIssued > Number(existing.requested_qty)) {
        throw new BadRequestException(
          `issued_qty cannot exceed order_qty for ${item.item_code}`
        )
      }
      existing.issued_qty = nextIssued
      if (nextIssued === Number(existing.requested_qty)) {
        existing.item_status = 'Issued'
      } else if (nextIssued > 0) {
        existing.item_status = 'Partially Issued'
      } else {
        existing.item_status = 'Rejected'
      }

      if (issuedDelta > 0) {
        issuedItems.push({
          item_code: existing.item_code,
          item_name: existing.item_name,
          qty: issuedDelta,
          uom: existing.uom
        })
      }
    })

    const allIssued = requisition.items.every(
      (item) => Number(item.issued_qty) === Number(item.requested_qty)
    )
    const newStatus = allIssued
      ? RequisitionStatus.Issued
      : RequisitionStatus.PartiallyIssued

    requisition.status = newStatus
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
      // Build a map of item_code → erp_mr_item_name for linking
      const mrItemMap = new Map(
        requisition.items
          .filter((i) => i.erp_mr_item_name)
          .map((i) => [i.item_code, i.erp_mr_item_name!])
      )

      const sePayload = {
        doctype: 'Stock Entry',
        stock_entry_type: 'Material Transfer',
        company: requisition.company,
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
        requisition.erp_synced = true
        requisition.last_synced_at = new Date()
        await this.requisitionsRepo.save(requisition)
      } catch (err: any) {
        this.logger.warn(`Failed to create Stock Entry for requisition ${requisitionId}: ${err.message}`)
      }
    }

    await this.notificationsService.notifyStatusChange(String(requisitionId), newStatus)
    return { ok: true, status: newStatus }
  }

  // ── Confirm (Kitchen) ─────────────────────────────────────────────────────

  async confirm(requisitionId: number, dto: ConfirmRequisitionDto) {
    const requisition = await this.getOne(requisitionId)
    if (
      ![
        RequisitionStatus.Submitted,
        RequisitionStatus.Issued,
        RequisitionStatus.PartiallyIssued
      ].includes(requisition.status)
    ) {
      throw new BadRequestException('Requisition is not ready to confirm')
    }
    const itemMap = new Map(requisition.items.map((item) => [item.item_code, item]))

    dto.items.forEach((item) => {
      const existing = itemMap.get(item.item_code)
      if (!existing) {
        throw new BadRequestException(`Item not found: ${item.item_code}`)
      }
      if (item.received_qty > Number(existing.issued_qty)) {
        throw new BadRequestException(
          `received_qty cannot exceed issued_qty for ${item.item_code}`
        )
      }
      if (item.received_qty < 0) {
        throw new BadRequestException(
          `received_qty must be 0 or greater for ${item.item_code}`
        )
      }
      const desired =
        item.action === 'accept'
          ? Number(existing.issued_qty)
          : item.action === 'reject'
          ? Number(existing.received_qty || 0)
          : Number(item.received_qty)
      const nextReceived = Math.max(Number(existing.received_qty || 0), desired)
      existing.received_qty = nextReceived
      if (nextReceived <= 0) {
        existing.item_status = 'Rejected'
      } else if (nextReceived < Number(existing.requested_qty)) {
        existing.item_status = 'Partially Issued'
      } else {
        existing.item_status = 'Issued'
      }
    })

    const newStatus = RequisitionStatus.PartiallyIssued

    requisition.status = newStatus
    requisition.completed_at = null
    await this.requisitionsRepo.save(requisition)
    await this.requisitionItemsRepo.save(requisition.items)

    await this.notificationsService.notifyStatusChange(String(requisitionId), newStatus)

    return { ok: true, status: newStatus }
  }

  // ── Finalize (Kitchen) ────────────────────────────────────────────────────

  async finalize(requisitionId: number) {
    const requisition = await this.getOne(requisitionId)
    if (
      ![
        RequisitionStatus.Issued,
        RequisitionStatus.PartiallyIssued
      ].includes(requisition.status)
    ) {
      throw new BadRequestException('Requisition is not ready to finalize')
    }
    requisition.status = RequisitionStatus.Completed
    requisition.completed_at = new Date()
    await this.requisitionsRepo.save(requisition)

    if (requisition.stock_entry) {
      // Draft Stock Entry already exists in ERP — submit it
      await this.queueService.enqueueErpWrite('submit_stock_entry', {
        action: 'submit_stock_entry',
        payload: { name: requisition.stock_entry }
      })
    } else {
      // No SE created during issue — create one now from received/issued quantities
      const hasActivity = requisition.items.some(
        (item) => Number(item.received_qty) > 0 || Number(item.issued_qty) > 0
      )
      if (hasActivity) {
        await this.queueService.enqueueCreateStockEntry({
          requisitionId: String(requisitionId)
        })
      }
    }

    return { ok: true, status: requisition.status }
  }

  // ── Reject / Cancel / Resolve ─────────────────────────────────────────────

  async reject(requisitionId: number, reason?: string) {
    const requisition = await this.getOne(requisitionId)
    requisition.status = RequisitionStatus.Rejected
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
    if (
      ![
        RequisitionStatus.Submitted,
        RequisitionStatus.Issued,
        RequisitionStatus.PartiallyIssued
      ].includes(requisition.status)
    ) {
      throw new BadRequestException('Only pending requisitions can be cancelled')
    }
    requisition.status = RequisitionStatus.Rejected
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
    requisition.status = RequisitionStatus.Completed
    requisition.completed_at = new Date()
    await this.requisitionsRepo.save(requisition)
    return { ok: true }
  }

  // ── Store-initiated transfer (no kitchen request needed) ─────────────────

  async listSentTransfers(sourceWarehouse: string): Promise<Requisition[]> {
    return this.requisitionsRepo.find({
      where: [
        { source_warehouse: sourceWarehouse, status: RequisitionStatus.Issued },
        { source_warehouse: sourceWarehouse, status: RequisitionStatus.Completed },
      ],
      relations: ['items'],
      order: { created_at: 'DESC' },
    })
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

    const today = new Date().toISOString().split('T')[0]

    const req = this.requisitionsRepo.create({
      user_id:          user.user_id,
      warehouse:        dto.target_warehouse,
      source_warehouse: user.source_warehouse,
      company:          user.company,
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
      const mrPayload = this.buildMaterialRequestPayload(saved)
      const mrName = await this.erpService.createMaterialRequestDraft(mrPayload)
      saved.erp_name = mrName
      await this.erpService.submitMaterialRequest(mrName)

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
        company: user.company,
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
      saved.erp_synced = true
      saved.last_synced_at = new Date()
      await this.requisitionsRepo.save(saved)
    } catch (e: any) {
      erpError = e?.message ?? 'ERP draft creation failed'
      this.logger.warn(`Store transfer ERP sync failed for KR-${saved.id}: ${erpError}`)
    }

    return {
      ok: true,
      requisition_id: saved.id,
      warehouse: dto.target_warehouse,
      items: dto.items.length,
      erp_draft: erpDraft,
      erp_error: erpError
    }
  }
}
