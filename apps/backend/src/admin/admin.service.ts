import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ErpService } from '../erp/erp.service'
import { QueueService } from '../queue/queue.service'
import { RequisitionService } from '../requisition/requisition.service'
import { UsersService } from '../users/users.service'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { WarehouseItemGroup } from '../database/entities/warehouse-item-group.entity'
import { WarehouseItem } from '../database/entities/warehouse-item.entity'
import { AppSettings } from '../database/entities/app-settings.entity'
import { Requisition } from '../database/entities/requisition.entity'
import { PriceChangeLog } from '../database/entities/price-change-log.entity'
import { StockEntryLineCache } from '../database/entities/stock-entry-line-cache.entity'
import { PurchasePriceCache } from '../database/entities/purchase-price-cache.entity'
import { ErpItemCache } from '../database/entities/erp-item-cache.entity'
import { ErpBinStockCache } from '../database/entities/erp-bin-stock-cache.entity'
import { CreateUserDto } from '../users/dto/create-user.dto'
import { UpdateUserDto } from '../users/dto/update-user.dto'

@Injectable()
export class AdminService {
  constructor(
    private readonly erpService: ErpService,
    private readonly queueService: QueueService,
    private readonly requisitionService: RequisitionService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(WarehouseItemGroup)
    private readonly warehouseGroupsRepo: Repository<WarehouseItemGroup>,
    @InjectRepository(WarehouseItem)
    private readonly warehouseItemsRepo: Repository<WarehouseItem>,
    @InjectRepository(AppSettings)
    private readonly appSettingsRepo: Repository<AppSettings>,
    @InjectRepository(Requisition)
    private readonly requisitionsRepo: Repository<Requisition>,
    @InjectRepository(PriceChangeLog)
    private readonly priceLogRepo: Repository<PriceChangeLog>,
    @InjectRepository(StockEntryLineCache)
    private readonly stockEntryCacheRepo: Repository<StockEntryLineCache>,
    @InjectRepository(PurchasePriceCache)
    private readonly purchasePriceCacheRepo: Repository<PurchasePriceCache>,
    @InjectRepository(ErpItemCache)
    private readonly itemCacheRepo: Repository<ErpItemCache>,
    @InjectRepository(ErpBinStockCache)
    private readonly binStockCacheRepo: Repository<ErpBinStockCache>
  ) {}

  listUsers() {
    return this.usersService.listUsers()
  }

  createUser(payload: CreateUserDto) {
    return this.usersService.createUser(payload)
  }

  getUser(id: number) {
    return this.usersService.getUser(id)
  }

  updateUser(id: number, payload: UpdateUserDto) {
    return this.usersService.updateUser(id, payload)
  }

  deactivateUser(id: number) {
    return this.usersService.deactivateUser(id)
  }

  listWarehouseGroups(warehouse: string) {
    return this.warehouseGroupsRepo.find({ where: { warehouse } })
  }

  async addWarehouseGroup(payload: {
    warehouse: string
    item_group: string
    company: string
  }) {
    const row = this.warehouseGroupsRepo.create(payload)
    return this.warehouseGroupsRepo.save(row)
  }

  async removeWarehouseGroup(id: number) {
    const existing = await this.warehouseGroupsRepo.findOne({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Mapping not found')
    }
    await this.warehouseGroupsRepo.delete({ id })
    return { ok: true }
  }

  listWarehouseItems(warehouse: string) {
    return this.warehouseItemsRepo.find({ where: { warehouse } })
  }

  async addWarehouseItem(payload: {
    warehouse: string
    item_code: string
    company: string
  }) {
    const row = this.warehouseItemsRepo.create(payload)
    return this.warehouseItemsRepo.save(row)
  }

  async removeWarehouseItem(id: number) {
    const existing = await this.warehouseItemsRepo.findOne({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Mapping not found')
    }
    await this.warehouseItemsRepo.delete({ id })
    return { ok: true }
  }

  listStockEntries() {
    return this.erpService.listDraftStockEntries()
  }

  async submitStockEntry(name: string) {
    const job = await this.queueService.enqueueErpWrite('submit_stock_entry', {
      action: 'submit_stock_entry',
      payload: { name }
    })
    return { job_id: job.id as string }
  }

  listStockReconciliations() {
    return this.erpService.listDraftStockReconciliations()
  }

  async submitStockReconciliation(name: string) {
    const job = await this.queueService.enqueueErpWrite(
      'submit_stock_reconciliation',
      {
        action: 'submit_stock_reconciliation',
        payload: { name }
      }
    )
    return { job_id: job.id as string }
  }

  async listRequisitionsWithFilters(filters: {
    status?: string
    warehouse?: string
  }) {
    const where: Record<string, any> = {}
    if (filters.status) {
      where.status = filters.status
    }
    if (filters.warehouse) {
      where.warehouse = filters.warehouse
    }
    return this.requisitionsRepo.find({ where, relations: ['items'] })
  }

  async listRequisitions(filters?: { status?: string; warehouse?: string }) {
    if (filters && (filters.status || filters.warehouse)) {
      return this.listRequisitionsWithFilters(filters)
    }
    return this.requisitionsRepo.find({ relations: ['items'] })
  }

  async getRequisitionSummary() {
    const db = this.requisitionsRepo.manager
    const rows = await db.query<{ status: string; count: string }[]>(
      `SELECT status, COUNT(*) as count FROM requisitions GROUP BY status`
    )
    const summary: Record<string, number> = {}
    rows.forEach((r) => { summary[r.status] = parseInt(r.count) })
    return summary
  }

  async listRequisitionsEnhanced(filters: {
    status?: string
    shift?: string
    date_from?: string
    date_to?: string
    kitchen?: string
  }) {
    const db = this.requisitionsRepo.manager
    const conditions: string[] = ['1=1']
    const params: unknown[] = []
    let idx = 1

    if (filters.status && filters.status !== 'All') {
      conditions.push(`r.status = $${idx++}`)
      params.push(filters.status)
    }
    if (filters.shift && filters.shift !== 'All') {
      conditions.push(`r.shift = $${idx++}`)
      params.push(filters.shift)
    }
    if (filters.date_from) {
      conditions.push(`r.requested_date >= $${idx++}`)
      params.push(filters.date_from)
    }
    if (filters.date_to) {
      conditions.push(`r.requested_date <= $${idx++}`)
      params.push(filters.date_to)
    }
    if (filters.kitchen) {
      conditions.push(`r.user_id = $${idx++}`)
      params.push(parseInt(filters.kitchen))
    }

    const whereClause = conditions.join(' AND ')

    const reqs = await db.query<
      {
        id: number
        warehouse: string
        source_warehouse: string
        shift: string
        status: string
        requested_date: string
        submitted_at: Date | null
        issued_at: Date | null
        completed_at: Date | null
        created_at: Date
        updated_at: Date
        notes: string | null
        store_note: string | null
        erp_name: string | null
        kitchen_name: string
        user_id: number
        item_count: string
      }[]
    >(
      `SELECT r.id, r.warehouse, r.source_warehouse, r.shift, r.status,
              r.requested_date, r.submitted_at, r.issued_at, r.completed_at,
              r.created_at, r.updated_at, r.notes, r.store_note, r.erp_name,
              r.user_id,
              COALESCE(u.full_name, 'Unknown') AS kitchen_name,
              COUNT(ri.id) AS item_count
       FROM requisitions r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN requisition_items ri ON ri.requisition_id = r.id
       WHERE ${whereClause}
       GROUP BY r.id, u.full_name
       ORDER BY
         CASE r.status
           WHEN 'Submitted' THEN 1
           WHEN 'Partially Issued' THEN 2
           WHEN 'Issued' THEN 3
           WHEN 'Disputed' THEN 4
           WHEN 'Completed' THEN 5
           WHEN 'Rejected' THEN 6
           ELSE 7
         END, r.submitted_at ASC NULLS LAST`,
      params
    )

    // Fetch items for all returned requisitions
    const ids = reqs.map((r) => r.id)
    let itemsMap = new Map<number, unknown[]>()
    if (ids.length > 0) {
      const items = await db.query<{ requisition_id: number }[]>(
        `SELECT * FROM requisition_items WHERE requisition_id = ANY($1)`,
        [ids]
      )
      items.forEach((item) => {
        const arr = itemsMap.get(item.requisition_id) ?? []
        arr.push(item)
        itemsMap.set(item.requisition_id, arr)
      })
    }

    return reqs.map((r) => ({
      ...r,
      item_count: parseInt(r.item_count),
      items: itemsMap.get(r.id) ?? []
    }))
  }

  resolveRequisition(id: string) {
    return this.requisitionService.resolve(Number(id))
  }

  async getSettings() {
    let settings = await this.appSettingsRepo.findOne({ where: { id: 1 } })
    if (!settings) {
      settings = this.appSettingsRepo.create({
        id: 1,
        erp_base_url: this.configService.get<string>('ERP_BASE_URL') || null
      })
      settings = await this.appSettingsRepo.save(settings)
    }
    return settings
  }

  async updateSettings(payload: { erp_base_url?: string }) {
    let settings = await this.appSettingsRepo.findOne({ where: { id: 1 } })
    if (!settings) {
      settings = this.appSettingsRepo.create({ id: 1 })
    }
    if (payload.erp_base_url !== undefined) {
      settings.erp_base_url = payload.erp_base_url
    }
    await this.appSettingsRepo.save(settings)
    return settings
  }

  async testSettings() {
    await this.erpService.getWarehouses(undefined)
    return { ok: true }
  }

  getPriceLists() {
    return this.erpService.getPriceLists()
  }

  async listPrices(priceList: string) {
    const [erpPrices, catalogRows] = await Promise.all([
      this.erpService.getItemPrices(priceList),
      this.priceLogRepo.manager.query<
        { item_code: string; item_name: string }[]
      >(`SELECT DISTINCT ON (item_code) item_code, item_name
         FROM price_change_log
         WHERE item_name IS NOT NULL
         ORDER BY item_code, changed_at DESC`)
    ])
    const nameFromLog = new Map(catalogRows.map((r) => [r.item_code, r.item_name]))
    return erpPrices.map((p) => ({
      ...p,
      item_name: nameFromLog.get(p.item_code) ?? p.item_code
    }))
  }

  async updatePrice(
    itemCode: string,
    priceList: string,
    newRate: number,
    userId: number,
    userName: string,
    itemName?: string
  ) {
    // Get current price for audit log
    const current = await this.erpService.getItemPrices(priceList).then(
      (prices) => prices.find((p) => p.item_code === itemCode)
    )
    const oldPrice = current ? Number(current.price_list_rate) : null

    await this.erpService.upsertItemPrice(itemCode, priceList, newRate, current?.uom)

    const log = this.priceLogRepo.create({
      item_code: itemCode,
      item_name: itemName ?? current?.item_code ?? itemCode,
      price_list: priceList,
      old_price: oldPrice,
      new_price: newRate,
      changed_by_id: userId,
      changed_by_name: userName
    })
    await this.priceLogRepo.save(log)
    return { ok: true, old_price: oldPrice, new_price: newRate }
  }

  async getPriceHistory(itemCode?: string) {
    const where = itemCode ? { item_code: itemCode } : {}
    return this.priceLogRepo.find({
      where,
      order: { changed_at: 'DESC' },
      take: 100
    })
  }

  async syncPurchasePrices(): Promise<{ receipts: number; lines: number }> {
    // Fetch purchase receipts from last 12 months
    const dateTo = new Date().toISOString().split('T')[0]
    const dateFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]

    const receipts = await this.erpService.listPurchaseReceipts(dateFrom, dateTo)
    if (receipts.length === 0) return { receipts: 0, lines: 0 }

    // Batch fetch line items (chunks of 50)
    const CHUNK = 50
    const allItems: Awaited<ReturnType<typeof this.erpService.listPurchaseReceiptItemsDetailed>> = []
    for (let i = 0; i < receipts.length; i += CHUNK) {
      const names = receipts.slice(i, i + CHUNK).map((r) => r.name)
      const items = await this.erpService.listPurchaseReceiptItemsDetailed(names)
      allItems.push(...items)
    }

    // Build receipt → { supplier, posting_date } map
    const receiptMap = new Map(
      receipts.map((r) => [r.name, { supplier: r.supplier ?? '', posting_date: r.posting_date ?? dateFrom }])
    )

    // Resolve supplier names from cache
    const supplierNameMap = new Map<string, string>()
    const db = this.purchasePriceCacheRepo.manager
    try {
      const suppliers = await db.query<{ name: string; supplier_name: string }[]>(
        `SELECT name, supplier_name FROM supplier_list_cache`
      )
      suppliers.forEach((s) => supplierNameMap.set(s.name, s.supplier_name))
    } catch { /* non-fatal */ }

    // Clear existing cache (full refresh)
    await this.purchasePriceCacheRepo.clear()

    // Build rows
    const rows = allItems
      .filter((item) => Number(item.rate) > 0)
      .map((item) => {
        const receipt = receiptMap.get(item.parent)
        return this.purchasePriceCacheRepo.create({
          receipt_name: item.parent,
          posting_date: receipt?.posting_date ?? dateFrom,
          item_code: item.item_code,
          item_name: item.item_name || null,
          vendor_id: receipt?.supplier ?? '',
          vendor_name: supplierNameMap.get(receipt?.supplier ?? '') || receipt?.supplier || null,
          rate: Number(item.rate),
          qty: Number(item.qty),
          uom: item.uom || null
        })
      })

    // Save in batches of 200
    const BATCH = 200
    for (let i = 0; i < rows.length; i += BATCH) {
      await this.purchasePriceCacheRepo.save(rows.slice(i, i + BATCH))
    }

    return { receipts: receipts.length, lines: rows.length }
  }

  async getPurchasePriceSyncInfo(): Promise<{ last_synced: Date | null; row_count: number }> {
    const latest = await this.purchasePriceCacheRepo.findOne({
      where: {},
      order: { synced_at: 'DESC' }
    })
    const count = await this.purchasePriceCacheRepo.count()
    return { last_synced: latest?.synced_at ?? null, row_count: count }
  }

  async getVendorPriceHistory(search?: string) {
    const db = this.purchasePriceCacheRepo.manager

    // Query from synced purchase receipt cache
    let whereClause = 'WHERE 1=1'
    const params: unknown[] = []
    if (search) {
      whereClause += ` AND (LOWER(ppc.item_code) LIKE $1 OR LOWER(COALESCE(ppc.item_name, '')) LIKE $1)`
      params.push(`%${search.toLowerCase()}%`)
    }

    const rows = await db.query<{
      item_code: string
      item_name: string
      vendor_id: string
      vendor_name: string
      rate: string
      uom: string | null
      qty: string
      posting_date: string
    }[]>(
      `SELECT
         ppc.item_code,
         COALESCE(ppc.item_name, ppc.item_code) AS item_name,
         ppc.vendor_id,
         COALESCE(ppc.vendor_name, ppc.vendor_id) AS vendor_name,
         ppc.rate::numeric AS rate,
         ppc.uom,
         ppc.qty::numeric AS qty,
         ppc.posting_date::text AS posting_date
       FROM purchase_price_cache ppc
       ${whereClause}
       ORDER BY ppc.item_code, ppc.posting_date DESC`,
      params
    )

    // Group by item then by vendor
    const itemMap = new Map<string, {
      item_code: string
      item_name: string
      vendors: Map<string, {
        vendor_id: string
        vendor_name: string
        uom: string | null
        latest_rate: number
        latest_date: string
        history: { date: string; rate: number; qty: number }[]
      }>
    }>()

    for (const row of rows) {
      if (!itemMap.has(row.item_code)) {
        itemMap.set(row.item_code, { item_code: row.item_code, item_name: row.item_name, vendors: new Map() })
      }
      const item = itemMap.get(row.item_code)!
      if (!item.vendors.has(row.vendor_id)) {
        item.vendors.set(row.vendor_id, {
          vendor_id: row.vendor_id,
          vendor_name: row.vendor_name,
          uom: row.uom,
          latest_rate: parseFloat(row.rate),
          latest_date: row.posting_date,
          history: []
        })
      }
      item.vendors.get(row.vendor_id)!.history.push({
        date: row.posting_date,
        rate: parseFloat(row.rate),
        qty: parseFloat(row.qty)
      })
    }

    return Array.from(itemMap.values()).map((item) => ({
      item_code: item.item_code,
      item_name: item.item_name,
      vendor_count: item.vendors.size,
      vendors: Array.from(item.vendors.values())
    }))
  }

  // ── Reports ──────────────────────────────────────────────────────────────

  async reportConsumption(from: string, to: string) {
    const db = this.requisitionsRepo.manager
    const daily = await db.query<
      { day: string; total_issued: string }[]
    >(
      `SELECT r.requested_date AS day, SUM(ri.issued_qty) AS total_issued
       FROM requisitions r
       JOIN requisition_items ri ON ri.requisition_id = r.id
       WHERE r.status = 'Completed'
         AND r.requested_date BETWEEN $1 AND $2
       GROUP BY r.requested_date
       ORDER BY r.requested_date ASC`,
      [from, to]
    )

    const byKitchen = await db.query<
      { kitchen: string; total_issued: string }[]
    >(
      `SELECT COALESCE(u.full_name, r.warehouse) AS kitchen,
              SUM(ri.issued_qty) AS total_issued
       FROM requisitions r
       JOIN requisition_items ri ON ri.requisition_id = r.id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.status = 'Completed'
         AND r.requested_date BETWEEN $1 AND $2
       GROUP BY kitchen
       ORDER BY total_issued DESC`,
      [from, to]
    )

    const topItems = await db.query<
      { item_name: string; item_code: string; total_issued: string }[]
    >(
      `SELECT ri.item_name, ri.item_code, SUM(ri.issued_qty) AS total_issued
       FROM requisitions r
       JOIN requisition_items ri ON ri.requisition_id = r.id
       WHERE r.status = 'Completed'
         AND r.requested_date BETWEEN $1 AND $2
         AND ri.item_name IS NOT NULL
       GROUP BY ri.item_name, ri.item_code
       ORDER BY total_issued DESC
       LIMIT 20`,
      [from, to]
    )

    return {
      daily: daily.map((r) => ({ day: r.day, value: parseFloat(r.total_issued) })),
      byKitchen: byKitchen.map((r) => ({ kitchen: r.kitchen, value: parseFloat(r.total_issued) })),
      topItems: topItems.map((r) => ({
        item_name: r.item_name || r.item_code,
        item_code: r.item_code,
        total_issued: parseFloat(r.total_issued)
      }))
    }
  }

  async reportAging(from: string, to: string) {
    const db = this.requisitionsRepo.manager
    const byWarehouse = await db.query<
      {
        store_warehouse: string
        total: string
        avg_hours: string
        max_hours: string
        sla_breaches: string
      }[]
    >(
      `SELECT r.source_warehouse AS store_warehouse,
              COUNT(*) AS total,
              ROUND(AVG(EXTRACT(EPOCH FROM (r.issued_at - r.submitted_at)) / 3600)::numeric, 2) AS avg_hours,
              ROUND(MAX(EXTRACT(EPOCH FROM (r.issued_at - r.submitted_at)) / 3600)::numeric, 2) AS max_hours,
              COUNT(CASE WHEN EXTRACT(EPOCH FROM (r.issued_at - r.submitted_at)) / 3600 > 4 THEN 1 END) AS sla_breaches
       FROM requisitions r
       WHERE r.submitted_at IS NOT NULL
         AND r.issued_at IS NOT NULL
         AND r.requested_date BETWEEN $1 AND $2
       GROUP BY r.source_warehouse
       ORDER BY avg_hours DESC`,
      [from, to]
    )

    const distribution = await db.query<{ bucket: string; count: string }[]>(
      `SELECT
         CASE
           WHEN EXTRACT(EPOCH FROM (r.issued_at - r.submitted_at)) / 3600 <= 1 THEN '0-1h'
           WHEN EXTRACT(EPOCH FROM (r.issued_at - r.submitted_at)) / 3600 <= 2 THEN '1-2h'
           WHEN EXTRACT(EPOCH FROM (r.issued_at - r.submitted_at)) / 3600 <= 4 THEN '2-4h'
           ELSE '>4h (SLA breach)'
         END AS bucket,
         COUNT(*) AS count
       FROM requisitions r
       WHERE r.submitted_at IS NOT NULL
         AND r.issued_at IS NOT NULL
         AND r.requested_date BETWEEN $1 AND $2
       GROUP BY bucket
       ORDER BY MIN(EXTRACT(EPOCH FROM (r.issued_at - r.submitted_at)))`,
      [from, to]
    )

    return {
      byWarehouse: byWarehouse.map((r) => ({
        store_warehouse: r.store_warehouse,
        total: parseInt(r.total),
        avg_hours: parseFloat(r.avg_hours ?? '0'),
        max_hours: parseFloat(r.max_hours ?? '0'),
        sla_breaches: parseInt(r.sla_breaches)
      })),
      distribution: distribution.map((r) => ({ bucket: r.bucket, count: parseInt(r.count) }))
    }
  }

  async reportWastage(from: string, to: string) {
    const db = this.requisitionsRepo.manager
    const rows = await db.query<
      {
        day: string
        kitchen: string
        item_name: string
        item_code: string
        uom: string | null
        closing_stock: string
        actual_closing: string
        variance: string
      }[]
    >(
      `SELECT r.requested_date AS day,
              COALESCE(u.full_name, r.warehouse) AS kitchen,
              ri.item_name, ri.item_code, ri.uom,
              ri.closing_stock, ri.actual_closing,
              (ri.closing_stock::numeric - ri.actual_closing::numeric) AS variance
       FROM requisition_items ri
       JOIN requisitions r ON r.id = ri.requisition_id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE ri.actual_closing IS NOT NULL
         AND ri.closing_stock::numeric != ri.actual_closing::numeric
         AND r.requested_date BETWEEN $1 AND $2
       ORDER BY ABS(ri.closing_stock::numeric - ri.actual_closing::numeric) DESC
       LIMIT 100`,
      [from, to]
    )

    const summary = await db.query<{ total_events: string; total_variance: string }[]>(
      `SELECT COUNT(*) AS total_events,
              SUM(ABS(ri.closing_stock::numeric - ri.actual_closing::numeric)) AS total_variance
       FROM requisition_items ri
       JOIN requisitions r ON r.id = ri.requisition_id
       WHERE ri.actual_closing IS NOT NULL
         AND ri.closing_stock::numeric != ri.actual_closing::numeric
         AND r.requested_date BETWEEN $1 AND $2`,
      [from, to]
    )

    return {
      summary: {
        total_events: parseInt(summary[0]?.total_events ?? '0'),
        total_variance: parseFloat(summary[0]?.total_variance ?? '0')
      },
      rows: rows.map((r) => ({
        day: r.day,
        kitchen: r.kitchen,
        item_name: r.item_name || r.item_code,
        item_code: r.item_code,
        uom: r.uom,
        closing_stock: parseFloat(r.closing_stock),
        actual_closing: parseFloat(r.actual_closing),
        variance: parseFloat(r.variance)
      }))
    }
  }

  async reportVendorPerformance() {
    const db = this.requisitionsRepo.manager
    const rows = await db.query<
      {
        vendor_id: string
        vendor_name: string | null
        total_pos: string
        total_receipts: string
        total_ordered_qty: string
        total_ordered_value: string
      }[]
    >(
      `SELECT vol.vendor_id,
              COALESCE(slc.supplier_name, vol.vendor_id) AS vendor_name,
              COUNT(DISTINCT vop.id) AS total_pos,
              COUNT(DISTINCT vr.id) AS total_receipts,
              SUM(vol.qty) AS total_ordered_qty,
              SUM(vol.qty * vol.price) AS total_ordered_value
       FROM vendor_order_lines vol
       LEFT JOIN vendor_order_pos vop ON vop.vendor_order_id = vol.vendor_order_id
                                     AND vop.vendor_id = vol.vendor_id
                                     AND vop.status = 'po_created'
       LEFT JOIN vendor_receipts vr ON vr.vendor_id = vol.vendor_id
                                   AND vr.po_id = vop.po_id
       LEFT JOIN supplier_list_cache slc ON slc.name = vol.vendor_id
       GROUP BY vol.vendor_id, COALESCE(slc.supplier_name, vol.vendor_id)
       ORDER BY total_ordered_value DESC`
    )

    return rows.map((r) => ({
      vendor_id: r.vendor_id,
      vendor_name: r.vendor_name || r.vendor_id,
      total_pos: parseInt(r.total_pos),
      total_receipts: parseInt(r.total_receipts),
      receipt_rate: parseInt(r.total_pos) > 0
        ? Math.round((parseInt(r.total_receipts) / parseInt(r.total_pos)) * 100)
        : 0,
      total_ordered_qty: parseFloat(r.total_ordered_qty ?? '0'),
      total_ordered_value: parseFloat(r.total_ordered_value ?? '0')
    }))
  }

  async reportCostSummary(from: string, to: string) {
    const db = this.requisitionsRepo.manager
    const byVendor = await db.query<
      { vendor_name: string; total_value: string; total_lines: string }[]
    >(
      `SELECT COALESCE(slc.supplier_name, vol.vendor_id) AS vendor_name,
              SUM(vol.qty * vol.price) AS total_value,
              COUNT(*) AS total_lines
       FROM vendor_order_lines vol
       JOIN vendor_orders vo ON vo.id = vol.vendor_order_id
       LEFT JOIN supplier_list_cache slc ON slc.name = vol.vendor_id
       WHERE DATE(vo.created_at) BETWEEN $1 AND $2
       GROUP BY vendor_name
       ORDER BY total_value DESC`,
      [from, to]
    )

    const byItem = await db.query<
      { item_name: string; item_code: string; total_qty: string; total_value: string }[]
    >(
      `SELECT COALESCE(vol.item_name, vol.item_code) AS item_name,
              vol.item_code,
              SUM(vol.qty) AS total_qty,
              SUM(vol.qty * vol.price) AS total_value
       FROM vendor_order_lines vol
       JOIN vendor_orders vo ON vo.id = vol.vendor_order_id
       WHERE DATE(vo.created_at) BETWEEN $1 AND $2
         AND vol.price > 0
       GROUP BY item_name, vol.item_code
       ORDER BY total_value DESC
       LIMIT 20`,
      [from, to]
    )

    const total = byVendor.reduce((s, r) => s + parseFloat(r.total_value ?? '0'), 0)

    return {
      total,
      byVendor: byVendor.map((r) => ({
        vendor_name: r.vendor_name,
        total_value: parseFloat(r.total_value ?? '0'),
        total_lines: parseInt(r.total_lines)
      })),
      byItem: byItem.map((r) => ({
        item_name: r.item_name,
        item_code: r.item_code,
        total_qty: parseFloat(r.total_qty ?? '0'),
        total_value: parseFloat(r.total_value ?? '0')
      }))
    }
  }

  async syncStockEntries(warehouse: string): Promise<{ synced: number; entries: number }> {
    // Pull submitted stock entries from ERP for the last 90 days
    const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]

    const entries = await this.erpService.listSubmittedStockEntriesByWarehouse(warehouse, dateFrom)
    if (entries.length === 0) return { synced: 0, entries: 0 }

    // Batch fetch line items (chunks of 50 to avoid URL length limits)
    const CHUNK = 50
    const allDetails: Awaited<ReturnType<typeof this.erpService.getStockEntryDetails>> = []
    for (let i = 0; i < entries.length; i += CHUNK) {
      const names = entries.slice(i, i + CHUNK).map((e) => e.name)
      const details = await this.erpService.getStockEntryDetails(names)
      allDetails.push(...details)
    }

    // Delete existing cache for this warehouse (full refresh)
    await this.stockEntryCacheRepo.delete({ warehouse })

    // Build entry → posting_date map
    const dateByEntry = new Map(entries.map((e) => [e.name, e.posting_date]))

    // Only keep rows where s_warehouse matches (item actually came OUT of this warehouse)
    const rows = allDetails
      .filter((d) => d.s_warehouse === warehouse && Number(d.qty) > 0)
      .map((d) => this.stockEntryCacheRepo.create({
        entry_name: d.parent,
        posting_date: dateByEntry.get(d.parent) ?? dateFrom,
        warehouse,
        item_code: d.item_code,
        item_name: d.item_name || null,
        uom: d.uom || null,
        qty: Number(d.qty)
      }))

    // Save in batches of 200
    const BATCH = 200
    for (let i = 0; i < rows.length; i += BATCH) {
      await this.stockEntryCacheRepo.save(rows.slice(i, i + BATCH))
    }

    return { synced: rows.length, entries: entries.length }
  }

  async getStockEntrySyncInfo(warehouse: string): Promise<{ last_synced: Date | null; row_count: number }> {
    const latest = await this.stockEntryCacheRepo.findOne({
      where: { warehouse },
      order: { synced_at: 'DESC' }
    })
    const count = await this.stockEntryCacheRepo.count({ where: { warehouse } })
    return { last_synced: latest?.synced_at ?? null, row_count: count }
  }

  async getLowStock(warehouse: string, days = 30) {
    const db = this.requisitionsRepo.manager

    // 1. Bin stock: prefer local cache, fallback to live ERP
    const cachedBins = await this.binStockCacheRepo.find({ where: { warehouse } })
    const binStock = cachedBins.length > 0
      ? cachedBins.map((b) => ({
          item_code: b.item_code,
          actual_qty: Number(b.actual_qty),
          stock_uom: b.stock_uom ?? '',
          valuation_rate: Number(b.valuation_rate)
        }))
      : await this.erpService.getBinStock(warehouse)
    const binMap = new Map(binStock.map((b) => [b.item_code, b]))

    // 2. Avg daily usage from local stock entry cache (outgoing transfers from ERP)
    const usageCacheRows = await db.query<{
      item_code: string
      item_name: string
      total_qty: string
      stock_uom: string
    }[]>(
      `SELECT item_code,
              MAX(item_name) AS item_name,
              SUM(qty)       AS total_qty,
              MAX(uom)       AS stock_uom
       FROM stock_entry_line_cache
       WHERE warehouse     = $1
         AND posting_date >= CURRENT_DATE - ($2 || ' days')::interval
       GROUP BY item_code`,
      [warehouse, days]
    )
    const usageMap = new Map(
      usageCacheRows.map((r) => [r.item_code, {
        total_qty: parseFloat(r.total_qty),
        avg_daily: parseFloat(r.total_qty) / days,
        item_name: r.item_name,
        stock_uom: r.stock_uom
      }])
    )

    // 3. Pending shortfalls from local requisitions
    const shortfallRows = await db.query<{ item_code: string; shortfall: string }[]>(
      `SELECT ri.item_code,
              SUM(GREATEST(0, ri.requested_qty::numeric - ri.issued_qty::numeric)) AS shortfall
       FROM requisition_items ri
       JOIN requisitions r ON r.id = ri.requisition_id
       WHERE r.status IN ('Submitted', 'Partially Issued')
         AND r.source_warehouse = $1
       GROUP BY ri.item_code`,
      [warehouse]
    )
    const shortfallMap = new Map(
      shortfallRows.map((r) => [r.item_code, parseFloat(r.shortfall)])
    )

    // 4. Build candidate set: items in bin stock AND/OR have usage history AND/OR have shortfall
    const allCodes = new Set([
      ...binStock.map((b) => b.item_code),
      ...usageMap.keys(),
      ...shortfallMap.keys()
    ])

    // 5. Resolve item names + filter disabled items from local cache
    const nameMap = new Map<string, string>()
    const disabledSet = new Set<string>()
    const codes = Array.from(allCodes)
    if (codes.length > 0) {
      const cachedItems = await this.itemCacheRepo.find({
        where: { item_code: In(codes) }
      })
      if (cachedItems.length > 0) {
        const returnedCodes = new Set(cachedItems.filter((i) => !i.disabled).map((i) => i.item_code))
        cachedItems.forEach((i) => {
          if (!i.disabled) nameMap.set(i.item_code, i.item_name ?? i.item_code)
          else disabledSet.add(i.item_code)
        })
      } else {
        // Fallback to live ERP if cache is empty
        try {
          const items = await this.erpService.getItemsByCodes(codes)
          const returnedCodes = new Set(items.map((i) => i.name))
          items.forEach((i) => nameMap.set(i.name, i.item_name))
          for (const code of codes) {
            if (!returnedCodes.has(code)) disabledSet.add(code)
          }
        } catch { /* non-fatal */ }
      }
      // Fill remaining names from usage cache
      usageCacheRows.forEach((r) => {
        if (r.item_name && !nameMap.has(r.item_code)) nameMap.set(r.item_code, r.item_name)
      })
    }

    const result: {
      item_code: string
      item_name: string
      actual_qty: number
      stock_uom: string
      avg_daily_usage: number
      days_remaining: number | null
      shortfall: number
      status: string
    }[] = []

    for (const code of allCodes) {
      // Skip disabled items
      if (disabledSet.has(code)) continue

      const bin = binMap.get(code)
      const usage = usageMap.get(code)
      const shortfall = shortfallMap.get(code) ?? 0
      const actual = bin ? Number(bin.actual_qty) : 0
      const avgDaily = usage?.avg_daily ?? 0
      const daysRemaining = avgDaily > 0 ? actual / avgDaily : null

      const isOutOfStock = actual <= 0
      const hasShortfall = shortfall > 0
      const isLowDays = daysRemaining !== null && daysRemaining < 7

      if (!isOutOfStock && !hasShortfall && !isLowDays) continue

      let status: string
      if (isOutOfStock) {
        status = 'out_of_stock'
      } else if ((hasShortfall && shortfall > actual) || (daysRemaining !== null && daysRemaining < 3)) {
        status = 'critical'
      } else {
        status = 'low'
      }

      result.push({
        item_code: code,
        item_name: nameMap.get(code) || usage?.item_name || code,
        actual_qty: actual,
        stock_uom: bin?.stock_uom || usage?.stock_uom || '',
        avg_daily_usage: Math.round(avgDaily * 1000) / 1000,
        days_remaining: daysRemaining !== null ? Math.round(daysRemaining * 10) / 10 : null,
        shortfall,
        status
      })
    }

    return result.sort((a, b) => {
      const order: Record<string, number> = { out_of_stock: 0, critical: 1, low: 2 }
      return (order[a.status] ?? 3) - (order[b.status] ?? 3)
    })
  }

  async getDashboardStats() {
    const db = this.requisitionsRepo.manager

    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const [kpis] = await db.query<
      {
        total_kitchens: string
        today_requisitions: string
        pending_requisitions: string
        partially_issued: string
      }[]
    >(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'Kitchen User' AND is_active = true) AS total_kitchens,
        (SELECT COUNT(*) FROM requisitions WHERE requested_date = $1) AS today_requisitions,
        (SELECT COUNT(*) FROM requisitions WHERE status = 'Submitted') AS pending_requisitions,
        (SELECT COUNT(*) FROM requisitions WHERE status = 'Partially Issued') AS partially_issued`,
      [today]
    )

    const pendingReqs = await db.query<
      {
        id: number
        warehouse: string
        shift: string
        status: string
        submitted_at: Date | null
        source_warehouse: string
        kitchen_name: string
        item_count: string
      }[]
    >(
      `SELECT r.id, r.warehouse, r.shift, r.status, r.submitted_at, r.source_warehouse,
              COALESCE(u.full_name, 'Unknown') AS kitchen_name,
              COUNT(ri.id) AS item_count
       FROM requisitions r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN requisition_items ri ON ri.requisition_id = r.id
       WHERE r.status IN ('Submitted', 'Partially Issued')
       GROUP BY r.id, u.full_name
       ORDER BY r.submitted_at ASC NULLS LAST
       LIMIT 10`
    )

    const consumptionTrend = await db.query<{ day: string; value: string }[]>(
      `SELECT r.requested_date AS day, COALESCE(SUM(ri.issued_qty), 0) AS value
       FROM requisitions r
       LEFT JOIN requisition_items ri ON ri.requisition_id = r.id
       WHERE r.status = 'Completed' AND r.requested_date >= $1
       GROUP BY r.requested_date
       ORDER BY r.requested_date ASC`,
      [sevenDaysAgo]
    )

    const topItems = await db.query<{ item: string; usage: string }[]>(
      `SELECT ri.item_name AS item, SUM(ri.issued_qty) AS usage
       FROM requisition_items ri
       JOIN requisitions r ON r.id = ri.requisition_id
       WHERE r.status = 'Completed'
         AND r.requested_date >= $1
         AND ri.item_name IS NOT NULL
         AND ri.issued_qty > 0
       GROUP BY ri.item_name
       ORDER BY usage DESC
       LIMIT 10`,
      [thirtyDaysAgo]
    )

    const recentActivity = await db.query<
      {
        id: number
        kitchen_name: string
        status: string
        shift: string
        item_count: string
        updated_at: Date
      }[]
    >(
      `SELECT r.id, COALESCE(u.full_name, 'Unknown') AS kitchen_name,
              r.status, r.shift, COUNT(ri.id) AS item_count, r.updated_at
       FROM requisitions r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN requisition_items ri ON ri.requisition_id = r.id
       WHERE r.status != 'Draft'
       GROUP BY r.id, u.full_name
       ORDER BY r.updated_at DESC
       LIMIT 8`
    )

    return {
      totalKitchens: parseInt(kpis.total_kitchens),
      todayRequisitions: parseInt(kpis.today_requisitions),
      pendingRequisitions: parseInt(kpis.pending_requisitions),
      partiallyIssued: parseInt(kpis.partially_issued),
      pendingReqs: pendingReqs.map((r) => ({
        ...r,
        item_count: parseInt(r.item_count)
      })),
      consumptionTrend: consumptionTrend.map((r) => ({
        day: r.day,
        value: parseFloat(r.value)
      })),
      topItems: topItems.map((r) => ({
        item: r.item,
        usage: parseFloat(r.usage)
      })),
      recentActivity: recentActivity.map((r) => ({
        ...r,
        item_count: parseInt(r.item_count)
      }))
    }
  }
}
