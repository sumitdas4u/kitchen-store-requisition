import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
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
  constructor(
    @InjectRepository(Requisition)
    private readonly requisitionsRepo: Repository<Requisition>,
    @InjectRepository(RequisitionItem)
    private readonly requisitionItemsRepo: Repository<RequisitionItem>,
    private readonly queueService: QueueService,
    private readonly notificationsService: NotificationsService,
    private readonly erpService: ErpService
  ) {}

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
      items: items as RequisitionItem[]
    })

    const saved = await this.requisitionsRepo.save(requisition)
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
    const saved = await this.requisitionsRepo.save(requisition)
    return saved
  }

  async deleteDraft(requisitionId: number) {
    const requisition = await this.getOne(requisitionId)
    if (requisition.status !== RequisitionStatus.Draft) {
      throw new BadRequestException('Only draft requisitions can be deleted')
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
    await this.requisitionsRepo.save(requisition)
    await this.notificationsService.notifyStatusChange(
      String(requisitionId),
      RequisitionStatus.Submitted
    )

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
    })

    const allIssued = requisition.items.every(
      (item) => Number(item.issued_qty) === Number(item.requested_qty)
    )
    const newStatus = allIssued
      ? RequisitionStatus.Issued
      : RequisitionStatus.PartiallyIssued

    requisition.status = newStatus
    requisition.issued_at = new Date()
    if (dto.store_note !== undefined) {
      requisition.store_note = dto.store_note
    }
    await this.requisitionsRepo.save(requisition)
    await this.requisitionItemsRepo.save(requisition.items)

    await this.notificationsService.notifyStatusChange(String(requisitionId), newStatus)
    return { ok: true, status: newStatus }
  }

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
      // Store-initiated transfer: draft SE already exists in ERP — submit it
      await this.queueService.enqueueErpWrite('submit_stock_entry', {
        action: 'submit_stock_entry',
        payload: { name: requisition.stock_entry }
      })
    } else {
      // Kitchen requisition (or store transfer where ERP draft failed): create SE now
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

  async reject(requisitionId: number, reason?: string) {
    const requisition = await this.getOne(requisitionId)
    requisition.status = RequisitionStatus.Rejected
    requisition.notes = reason || null
    await this.requisitionsRepo.save(requisition)
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
    return { ok: true }
  }

  async resolve(requisitionId: number) {
    const requisition = await this.getOne(requisitionId)
    requisition.status = RequisitionStatus.Completed
    requisition.completed_at = new Date()
    await this.requisitionsRepo.save(requisition)
    return { ok: true }
  }

  // ── Store-initiated transfer (no kitchen request needed) ─────────────────────

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

    // Create a Draft Material Transfer in ERPNext immediately
    let erpDraft: string | null = null
    let erpError: string | null = null
    try {
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
          conversion_factor: 1
        }))
      }
      erpDraft = await this.erpService.createStockEntryDraft(sePayload)
      saved.stock_entry = erpDraft
      await this.requisitionsRepo.save(saved)
    } catch (e: any) {
      erpError = e?.message ?? 'ERP draft creation failed'
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
