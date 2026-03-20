import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { ErpService } from '../erp/erp.service'
import { RequisitionService } from '../requisition/requisition.service'
import { SupplierListCache } from '../database/entities/supplier-list-cache.entity'
import { ItemCatalogCache } from '../database/entities/item-catalog-cache.entity'
import { VendorItemOverride } from '../database/entities/vendor-item-override.entity'
import { VendorOrder } from '../database/entities/vendor-order.entity'
import { VendorOrderLine } from '../database/entities/vendor-order-line.entity'
import { VendorOrderPo } from '../database/entities/vendor-order-po.entity'
import { VendorReceipt } from '../database/entities/vendor-receipt.entity'
import { VendorReceiptLine } from '../database/entities/vendor-receipt-line.entity'
import { ErpBinStockCache } from '../database/entities/erp-bin-stock-cache.entity'
import { CreateVendorOrderDto } from './dto/create-vendor-order.dto'
import { VendorOverrideDto } from './dto/vendor-override.dto'
import { CreatePurchaseReceiptDto } from './dto/create-purchase-receipt.dto'

// ── In-memory stock cache (5-min TTL per warehouse) ───────────────────────────
interface StockEntry { qty: number; price: number }
interface StockCacheEntry { data: Map<string, StockEntry>; ts: number }
const STOCK_TTL_MS = 5 * 60 * 1000

@Injectable()
export class StoreService implements OnModuleInit {
  private readonly logger = new Logger(StoreService.name)
  private stockCache = new Map<string, StockCacheEntry>()
  private catalogRefreshing = false

  constructor(
    private readonly erpService: ErpService,
    private readonly requisitionService: RequisitionService,
    @InjectRepository(SupplierListCache)
    private readonly supplierCacheRepo: Repository<SupplierListCache>,
    @InjectRepository(ItemCatalogCache)
    private readonly catalogRepo: Repository<ItemCatalogCache>,
    @InjectRepository(VendorItemOverride)
    private readonly vendorOverrideRepo: Repository<VendorItemOverride>,
    @InjectRepository(VendorOrder)
    private readonly vendorOrderRepo: Repository<VendorOrder>,
    @InjectRepository(VendorOrderLine)
    private readonly vendorOrderLineRepo: Repository<VendorOrderLine>,
    @InjectRepository(VendorOrderPo)
    private readonly vendorOrderPoRepo: Repository<VendorOrderPo>,
    @InjectRepository(VendorReceipt)
    private readonly vendorReceiptRepo: Repository<VendorReceipt>,
    @InjectRepository(VendorReceiptLine)
    private readonly vendorReceiptLineRepo: Repository<VendorReceiptLine>,
    @InjectRepository(ErpBinStockCache)
    private readonly binStockCacheRepo: Repository<ErpBinStockCache>
  ) {}

  // ── Bootstrap ─────────────────────────────────────────────────────────────────

  async onModuleInit() {
    try {
      const count = await this.supplierCacheRepo.count()
      if (count === 0) {
        this.logger.log('Catalog cache empty — triggering background refresh')
        this.refreshCatalog().catch((e) =>
          this.logger.warn('Initial catalog refresh failed: ' + e.message)
        )
      } else {
        this.logger.log(`Catalog cache ready: ${count} suppliers`)
      }
    } catch (e) {
      this.logger.warn('onModuleInit check failed: ' + (e as Error).message)
    }
  }

  // ── Stock cache helper ────────────────────────────────────────────────────────

  private async getCachedStock(warehouse: string): Promise<Map<string, StockEntry>> {
    if (!warehouse) return new Map()
    // Check in-memory cache first (short TTL)
    const inMem = this.stockCache.get(warehouse)
    if (inMem && Date.now() - inMem.ts < STOCK_TTL_MS) return inMem.data

    // Try local DB cache (populated by admin sync)
    const dbRows = await this.binStockCacheRepo.find({ where: { warehouse } })
    if (dbRows.length > 0) {
      const data = new Map<string, StockEntry>()
      dbRows.forEach((row) =>
        data.set(row.item_code, {
          qty: Number(row.actual_qty || 0),
          price: Number(row.valuation_rate || 0)
        })
      )
      this.stockCache.set(warehouse, { data, ts: Date.now() })
      return data
    }

    // Fallback to live ERP if cache is empty
    const rows = await this.erpService.getBinStock(warehouse)
    const data = new Map<string, StockEntry>()
    rows.forEach((row) =>
      data.set(row.item_code, {
        qty: Number(row.actual_qty || 0),
        price: Number(row.valuation_rate || 0)
      })
    )
    this.stockCache.set(warehouse, { data, ts: Date.now() })
    return data
  }

  // ── Supplier list: DB cache only (synced from admin) ───────────────────────

  async listSuppliers() {
    return this.supplierCacheRepo.find({ order: { supplier_name: 'ASC' } })
  }

  // ── Full catalog refresh (slow — background / on-demand) ──────────────────────

  async refreshCatalog(): Promise<{ suppliers: number; items: number }> {
    if (this.catalogRefreshing) return { suppliers: 0, items: 0 }
    this.catalogRefreshing = true
    try {
      // 1. Suppliers
      const suppliers = await this.erpService.listSuppliers()
      if (suppliers.length > 0) {
        const rows = suppliers.map((s) =>
          this.supplierCacheRepo.create({
            name: s.name,
            supplier_name: s.supplier_name ?? null,
            mobile_no: (s as any).mobile_no ?? null,
            disabled: Boolean((s as any).disabled),
            cached_at: new Date()
          })
        )
        for (let i = 0; i < rows.length; i += 100) {
          await this.supplierCacheRepo.save(rows.slice(i, i + 100))
        }
        this.logger.log(`Refreshed ${rows.length} suppliers`)
      }
      const supplierNameMap = new Map(
        suppliers.map((s) => [s.name, s.supplier_name ?? s.name])
      )
      const activeSet = new Set(suppliers.map((s) => s.name))

      // 2. Purchase receipts (last 12 months)
      const now = new Date()
      const dateTo = now.toISOString().slice(0, 10)
      const df = new Date(now); df.setFullYear(df.getFullYear() - 1)
      const dateFrom = df.toISOString().slice(0, 10)
      const receipts = await this.erpService.listPurchaseReceipts(dateFrom, dateTo)
      this.logger.log(`Processing ${receipts.length} purchase receipts…`)

      // catalog map: item_code → entry
      const catalogMap = new Map<string, {
        item_name: string | null; uom: string | null
        vendor_id: string | null; vendor_name: string | null
        last_rate: number; last_po_date: string; receiptDate: string
        allVendors: Map<string, { rate: number; label: string }>
      }>()

      let idx = 0
      const workers = Array.from({ length: Math.min(5, receipts.length) }).map(async () => {
        while (idx < receipts.length) {
          const receipt = receipts[idx++]
          const supplierId = receipt.supplier
          if (!supplierId || !activeSet.has(supplierId)) continue
          try {
            const detail = await this.erpService.getPurchaseReceipt(receipt.name)
            if (!detail || !Array.isArray(detail.items)) continue
            const postingDate = detail.posting_date || receipt.posting_date || dateTo
            detail.items.forEach((row: any) => {
              const code = String(row.item_code || '').trim()
              if (!code) return
              const rate = Number(row.rate || 0)
              const label = `${supplierNameMap.get(supplierId) ?? supplierId} — Last PO`
              const existing = catalogMap.get(code)
              if (!existing || postingDate > existing.receiptDate) {
                const prevVendors = existing ? new Map(existing.allVendors) : new Map<string, { rate: number; label: string }>()
                prevVendors.set(supplierId, { rate, label })
                catalogMap.set(code, {
                  item_name: String(row.item_name || '').trim() || null,
                  uom: String(row.uom || row.stock_uom || '').trim() || null,
                  vendor_id: supplierId,
                  vendor_name: supplierNameMap.get(supplierId) ?? null,
                  last_rate: rate,
                  last_po_date: postingDate.slice(5).replace('-', '/'),
                  receiptDate: postingDate,
                  allVendors: prevVendors
                })
              } else {
                existing.allVendors.set(supplierId, { rate, label })
              }
            })
          } catch { /* skip failed receipt */ }
        }
      })
      await Promise.all(workers)

      // 3. Merge ERP item suppliers (price_list_rate) for extra vendors
      if (catalogMap.size > 0) {
        const codes = Array.from(catalogMap.keys())
        try {
          const erpSuppliers = await this.erpService.getItemSuppliers(codes)
          erpSuppliers.forEach((row) => {
            const entry = catalogMap.get(row.parent)
            if (!entry) return
            if (!entry.allVendors.has(row.supplier)) {
              entry.allVendors.set(row.supplier, {
                rate: Number(row.price_list_rate || 0),
                label: supplierNameMap.get(row.supplier) ?? row.supplier
              })
            }
          })
        } catch { /* best-effort */ }
      }

      // 4. Write to item_catalog_cache
      const manualOverrides = await this.vendorOverrideRepo.find({ where: { source: 'manual' } })
      const manualMap = new Map(manualOverrides.map((r) => [r.item_code, r.vendor_id]))

      const rows: ItemCatalogCache[] = []
      for (const [code, entry] of catalogMap) {
        const preferredVendor = manualMap.get(code) ?? entry.vendor_id
        const allVendors = Array.from(entry.allVendors.entries()).map(([vid, v]) => ({
          vendorId: vid, rate: v.rate, label: v.label
        }))
        allVendors.sort((a, b) =>
          a.vendorId === preferredVendor ? -1 : b.vendorId === preferredVendor ? 1 : 0
        )
        rows.push(
          this.catalogRepo.create({
            item_code: code,
            item_name: entry.item_name,
            uom: entry.uom,
            vendor_id: preferredVendor,
            vendor_name: preferredVendor ? (supplierNameMap.get(preferredVendor) ?? entry.vendor_name) : null,
            all_vendors: allVendors,
            last_rate: entry.last_rate,
            last_po_date: entry.last_po_date,
            cached_at: new Date()
          })
        )
      }

      for (let i = 0; i < rows.length; i += 50) {
        await this.catalogRepo.save(rows.slice(i, i + 50))
      }

      // Sync vendor_item_overrides (erp_receipt) for backward compat
      const existing = await this.vendorOverrideRepo.find({ where: { source: 'erp_receipt' } })
      const existingMap = new Map(existing.map((r) => [r.item_code, r]))
      const toSave = rows
        .filter((r) => r.vendor_id)
        .map((r) => {
          const ex = existingMap.get(r.item_code)
          if (ex) { ex.vendor_id = r.vendor_id!; ex.vendor_name = r.vendor_name; return ex }
          return this.vendorOverrideRepo.create({ item_code: r.item_code, vendor_id: r.vendor_id!, vendor_name: r.vendor_name, source: 'erp_receipt' })
        })
      if (toSave.length > 0) await this.vendorOverrideRepo.save(toSave)

      this.logger.log(`Catalog refresh done: ${suppliers.length} suppliers, ${rows.length} items`)
      return { suppliers: suppliers.length, items: rows.length }
    } finally {
      this.catalogRefreshing = false
    }
  }

  async getCatalogStatus() {
    const [supplierCount, itemCount] = await Promise.all([
      this.supplierCacheRepo.count(),
      this.catalogRepo.count()
    ])
    const lastRow = await this.catalogRepo.findOne({ order: { cached_at: 'DESC' }, where: {} })
    return {
      suppliers: supplierCount,
      items: itemCount,
      last_synced: lastRow?.cached_at ?? null,
      refreshing: this.catalogRefreshing
    }
  }

  // ── Shortage items: local DB + cached stock ───────────────────────────────────

  async getShortageItems(warehouse: string) {
    const requisitions = await this.requisitionService.listForStore()
    const itemMap = new Map<string, { item_code: string; item_name?: string | null; uom?: string | null; needed_qty: number }>()
    requisitions.forEach((req) => {
      req.items.forEach((item: any) => {
        const remaining = Math.max(0, Number(item.requested_qty) - Number(item.issued_qty || 0))
        if (remaining <= 0) return
        const existing = itemMap.get(item.item_code)
        if (existing) { existing.needed_qty += remaining }
        else { itemMap.set(item.item_code, { item_code: item.item_code, item_name: item.item_name, uom: item.uom, needed_qty: remaining }) }
      })
    })
    const codes = Array.from(itemMap.keys())
    if (codes.length === 0) return []

    const [stockMap, catalogRows, manualOverrides] = await Promise.all([
      this.getCachedStock(warehouse),
      this.catalogRepo.find({ where: { item_code: In(codes) } }),
      this.vendorOverrideRepo.find({ where: { source: 'manual' } })
    ])
    const catalogMap = new Map(catalogRows.map((r) => [r.item_code, r]))
    const manualMap = new Map(manualOverrides.map((r) => [r.item_code, r]))

    return codes.map((code) => {
      const req = itemMap.get(code)!
      const stock = stockMap.get(code)
      const cat = catalogMap.get(code)
      const manual = manualMap.get(code)

      const vendorId = manual?.vendor_id ?? cat?.vendor_id ?? ''
      const vendorName = manual?.vendor_name ?? cat?.vendor_name ?? null
      const allVendors = cat?.all_vendors ?? []
      const sortedVendors = vendorId
        ? [...allVendors.filter((v) => v.vendorId === vendorId), ...allVendors.filter((v) => v.vendorId !== vendorId)]
        : allVendors

      const stockQty = Number(stock?.qty || 0)

      return {
        item_code: code,
        item_name: req.item_name || cat?.item_name || code,
        uom: req.uom || cat?.uom || '',
        needed_qty: req.needed_qty,
        stock_qty: stockQty,
        shortfall: Math.max(0, req.needed_qty - stockQty),
        price: Number(cat?.last_rate || 0),
        vendor_id: vendorId,
        vendor_name: vendorName,
        last_po_date: cat?.last_po_date || '',
        all_vendors: sortedVendors
      }
    })
  }

  // ── Item search ───────────────────────────────────────────────────────────────

  async searchItems(search: string, warehouse: string) {
    if (!search || search.trim().length < 2) return []
    const q = search.trim().toLowerCase()

    const [cachedItems, stockMap, manualOverrides] = await Promise.all([
      this.catalogRepo
        .createQueryBuilder('c')
        .where('LOWER(c.item_code) LIKE :q OR LOWER(c.item_name) LIKE :q', { q: `%${q}%` })
        .limit(30)
        .getMany(),
      this.getCachedStock(warehouse),
      this.vendorOverrideRepo.find({ where: { source: 'manual' } })
    ])
    const manualMap = new Map(manualOverrides.map((r) => [r.item_code, r]))

    if (cachedItems.length > 0) {
      return cachedItems.map((cat) => {
        const stock = stockMap.get(cat.item_code)
        const manual = manualMap.get(cat.item_code)
        const vendorId = manual?.vendor_id ?? cat.vendor_id ?? ''
        const allVendors = cat.all_vendors ?? []
        const sortedVendors = vendorId
          ? [...allVendors.filter((v) => v.vendorId === vendorId), ...allVendors.filter((v) => v.vendorId !== vendorId)]
          : allVendors
        return {
          item_code: cat.item_code,
          item_name: cat.item_name,
          uom: cat.uom,
          stock_qty: Number(stock?.qty || 0),
          needed_qty: 0,
          shortfall: 0,
          price: Number(cat.last_rate || 0),
          vendor_id: vendorId,
          vendor_name: manual?.vendor_name ?? cat.vendor_name ?? null,
          last_po_date: cat.last_po_date,
          all_vendors: sortedVendors
        }
      })
    }

    // Fallback: live ERP search (only when cache is empty)
    const items = await this.erpService.searchItems(search.trim())
    if (items.length === 0) return []
    const codes = items.map((item) => item.name)
    const [suppliers, defaults] = await Promise.all([
      this.erpService.getItemSuppliers(codes),
      this.erpService.getItemDefaults(codes)
    ])
    const defaultMap = new Map<string, string>()
    defaults.forEach((r) => { if (r.default_supplier) defaultMap.set(r.parent, r.default_supplier) })
    const allSuppMap = new Map<string, Array<{ vendorId: string; rate: number }>>()
    const firstMap = new Map<string, string>()
    suppliers.forEach((r) => {
      if (!firstMap.has(r.parent)) firstMap.set(r.parent, r.supplier)
      const list = allSuppMap.get(r.parent) ?? []
      if (!list.find((s) => s.vendorId === r.supplier)) list.push({ vendorId: r.supplier, rate: Number(r.price_list_rate || 0) })
      allSuppMap.set(r.parent, list)
    })
    return items.map((item) => {
      const stock = stockMap.get(item.name)
      const manual = manualMap.get(item.name)
      const vendorId = manual?.vendor_id ?? defaultMap.get(item.name) ?? firstMap.get(item.name) ?? ''
      const allVendors = (allSuppMap.get(item.name) ?? []).map((s) => ({ vendorId: s.vendorId, rate: s.rate, label: s.vendorId }))
      return {
        item_code: item.name, item_name: item.item_name, uom: item.stock_uom,
        stock_qty: Number(stock?.qty || 0), needed_qty: 0, shortfall: 0,
        price: 0, vendor_id: vendorId, vendor_name: manual?.vendor_name ?? null,
        last_po_date: '', all_vendors: allVendors
      }
    })
  }

  // ── Vendor override ───────────────────────────────────────────────────────────

  async saveVendorOverride(dto: VendorOverrideDto) {
    if (!dto?.item_code || !dto?.vendor_id) throw new BadRequestException('item_code and vendor_id are required')
    const existing = await this.vendorOverrideRepo.findOne({ where: { item_code: dto.item_code, source: 'manual' } })
    if (existing) {
      existing.vendor_id = dto.vendor_id
      existing.vendor_name = dto.vendor_name ?? existing.vendor_name
      return this.vendorOverrideRepo.save(existing)
    }
    return this.vendorOverrideRepo.save(
      this.vendorOverrideRepo.create({ item_code: dto.item_code, vendor_id: dto.vendor_id, vendor_name: dto.vendor_name ?? null, source: 'manual' })
    )
  }

  // ── CRUD helpers ──────────────────────────────────────────────────────────────

  async listRequisitions() { return this.requisitionService.listForStore() }
  async getRequisition(id: number) { return this.requisitionService.getOne(id) }
  async getStock(warehouse: string) { return this.erpService.getBinStock(warehouse) }
  async listVendorOverrides() { return this.vendorOverrideRepo.find() }

  // ── Create POs ────────────────────────────────────────────────────────────────

  async createVendorOrders(
    user: { user_id: number; company: string; source_warehouse?: string | null },
    dto: CreateVendorOrderDto
  ) {
    if (!dto?.lines || dto.lines.length === 0) throw new BadRequestException('At least one line is required')
    if (!user.company) throw new BadRequestException('Company is required')

    const vendorOrder = this.vendorOrderRepo.create({ status: 'draft', created_by: user.user_id })
    const saved = await this.vendorOrderRepo.save(vendorOrder)

    const lines = dto.lines.map((line) =>
      this.vendorOrderLineRepo.create({
        vendor_order_id: saved.id, item_code: line.item_code, item_name: line.item_name ?? null,
        uom: line.uom ?? null, qty: Number(line.qty || 0), price: Number(line.price || 0),
        vendor_id: line.vendor_id, is_manual: Boolean(line.is_manual)
      })
    )
    await this.vendorOrderLineRepo.save(lines)

    const linesByVendor = new Map<string, VendorOrderLine[]>()
    lines.forEach((line) => {
      const list = linesByVendor.get(line.vendor_id) ?? []
      list.push(line)
      linesByVendor.set(line.vendor_id, list)
    })

    // Look up vendor names from supplier cache for PO records
    const vendorIds = Array.from(linesByVendor.keys())
    const supplierRows = vendorIds.length > 0
      ? await this.supplierCacheRepo.find({ where: { name: In(vendorIds) } })
      : []
    const vendorNameMap = new Map(supplierRows.map((s) => [s.name, s.supplier_name ?? s.name]))

    const purchaseOrders: Array<{ vendor_id: string; po_id: string }> = []
    const failedOrders:   Array<{ vendor_id: string; error: string }>  = []

    for (const [vendorId, vendorLines] of linesByVendor.entries()) {
      const vendorName = vendorNameMap.get(vendorId) ?? null
      try {
        const poId = await this.erpService.createPurchaseOrder({
          supplier: vendorId, company: user.company,
          set_warehouse: user.source_warehouse || undefined,
          transaction_date: new Date().toISOString().split('T')[0],
          schedule_date: new Date().toISOString().split('T')[0],
          items: vendorLines.map((l) => ({ item_code: l.item_code, item_name: l.item_name ?? undefined, uom: l.uom ?? undefined, qty: Number(l.qty), rate: Number(l.price) }))
        })
        await this.erpService.submitPurchaseOrder(poId)
        purchaseOrders.push({ vendor_id: vendorId, po_id: poId })
        await this.vendorOrderPoRepo.save(
          this.vendorOrderPoRepo.create({ vendor_order_id: saved.id, vendor_id: vendorId, vendor_name: vendorName, po_id: poId, status: 'po_created', error_message: null })
        )
      } catch (err: any) {
        const raw = err?.response?.data
        const msg: string = raw?.exception || raw?.message || (typeof raw === 'string' ? raw : null) || err.message || 'Unknown error'
        this.logger.warn(`PO failed for vendor ${vendorId}: ${msg}`)
        failedOrders.push({ vendor_id: vendorId, error: msg })
        await this.vendorOrderPoRepo.save(
          this.vendorOrderPoRepo.create({ vendor_order_id: saved.id, vendor_id: vendorId, vendor_name: vendorName, po_id: `FAIL-${Date.now()}`, status: 'failed', error_message: msg })
        )
      }
    }

    await this.vendorOrderRepo.save({ ...saved, status: 'submitted' })
    return { vendor_order_id: saved.id, purchase_orders: purchaseOrders, failed: failedOrders }
  }

  // ── History ───────────────────────────────────────────────────────────────────

  async listVendorOrderHistory() {
    // ERP-first: local DB stores only PO reference, details come from ERPNext
    const pos = await this.vendorOrderPoRepo.find({ order: { created_at: 'DESC' } })
    if (pos.length === 0) return []

    // Fetch ERP details for successful POs in parallel
    const realPos = pos.filter((p) => p.status === 'po_created' && !p.po_id.startsWith('FAIL-'))
    const erpResults = await Promise.allSettled(
      realPos.map((p) => this.erpService.getPurchaseOrder(p.po_id))
    )
    const erpMap = new Map<string, any>()
    realPos.forEach((p, i) => {
      const r = erpResults[i]
      if (r.status === 'fulfilled' && r.value) erpMap.set(p.po_id, r.value)
    })

    // For failed POs, fetch original lines from local DB
    const failedPos = pos.filter((p) => p.status === 'failed')
    const failedOrderIds = [...new Set(failedPos.map((p) => p.vendor_order_id))]
    const dbLines = failedOrderIds.length > 0
      ? await this.vendorOrderLineRepo.find({ where: { vendor_order_id: In(failedOrderIds) } })
      : []
    const dbLinesByOrderVendor = new Map<string, VendorOrderLine[]>()
    dbLines.forEach((l) => {
      const key = `${l.vendor_order_id}::${l.vendor_id}`
      const list = dbLinesByOrderVendor.get(key) ?? []
      list.push(l)
      dbLinesByOrderVendor.set(key, list)
    })

    return pos.map((p) => {
      const erp = erpMap.get(p.po_id)
      const erpItems = Array.isArray(erp?.items)
        ? erp.items.map((item: any) => ({
            item_code: item.item_code,
            item_name: item.item_name || item.item_code,
            qty:       Number(item.qty || 0),
            uom:       item.uom || item.stock_uom || '',
            rate:      Number(item.rate || 0),
          }))
        : []

      // For failed POs, use original lines from DB
      const dbItems = p.status === 'failed'
        ? (dbLinesByOrderVendor.get(`${p.vendor_order_id}::${p.vendor_id}`) ?? []).map((l) => ({
            item_code: l.item_code,
            item_name: l.item_name || l.item_code,
            qty:       Number(l.qty || 0),
            uom:       l.uom || '',
            rate:      Number(l.price || 0),
          }))
        : []

      return {
        id:            p.id,
        po_id:         p.po_id,
        vendor_order_id: p.vendor_order_id,
        vendor_id:     p.vendor_id,
        vendor_name:   p.vendor_name ?? null,
        status:        p.status,
        error_message: p.error_message ?? null,
        created_at:    p.created_at,
        erp_items:     erpItems.length > 0 ? erpItems : dbItems,
        erp_status:    erp?.status ?? null,
        erp_grand_total: erp?.grand_total ?? null,
      }
    })
  }

  async retryFailedPo(
    poRecordId: number,
    user: { user_id: number; company: string; source_warehouse?: string | null }
  ) {
    const poRecord = await this.vendorOrderPoRepo.findOne({ where: { id: poRecordId } })
    if (!poRecord) throw new BadRequestException('PO record not found')
    if (poRecord.status !== 'failed') throw new BadRequestException('Only failed POs can be retried')

    // Get original order lines for this vendor from the vendor_order
    const lines = await this.vendorOrderLineRepo.find({
      where: { vendor_order_id: poRecord.vendor_order_id, vendor_id: poRecord.vendor_id }
    })
    if (lines.length === 0) throw new BadRequestException('No order lines found for this PO')

    try {
      const poId = await this.erpService.createPurchaseOrder({
        supplier: poRecord.vendor_id,
        company: user.company,
        set_warehouse: user.source_warehouse || undefined,
        transaction_date: new Date().toISOString().split('T')[0],
        schedule_date: new Date().toISOString().split('T')[0],
        items: lines.map((l) => ({
          item_code: l.item_code, item_name: l.item_name ?? undefined,
          uom: l.uom ?? undefined, qty: Number(l.qty), rate: Number(l.price)
        }))
      })
      await this.erpService.submitPurchaseOrder(poId)

      // Update the PO record to success
      poRecord.po_id = poId
      poRecord.status = 'po_created'
      poRecord.error_message = null
      await this.vendorOrderPoRepo.save(poRecord)

      return { success: true, po_id: poId, vendor_id: poRecord.vendor_id }
    } catch (err: any) {
      const raw = err?.response?.data
      const msg: string = raw?.exception || raw?.message || (typeof raw === 'string' ? raw : null) || err.message || 'Unknown error'
      this.logger.warn(`Retry PO failed for vendor ${poRecord.vendor_id}: ${msg}`)

      // Update error message with latest error
      poRecord.error_message = msg
      await this.vendorOrderPoRepo.save(poRecord)

      return { success: false, error: msg, vendor_id: poRecord.vendor_id }
    }
  }

  async deleteFailedPo(poRecordId: number) {
    const poRecord = await this.vendorOrderPoRepo.findOne({ where: { id: poRecordId } })
    if (!poRecord) throw new BadRequestException('PO record not found')
    if (poRecord.status !== 'failed') throw new BadRequestException('Only failed POs can be deleted')
    await this.vendorOrderPoRepo.remove(poRecord)
    return { success: true }
  }

  async listOpenPurchaseOrders() {
    // Fetch open POs directly from ERPNext (primary source of truth)
    const erpPos = await this.erpService.listOpenPurchaseOrders()
    if (!erpPos.length) return []

    // Fetch full details (including items) for each PO
    const detailResults = await Promise.allSettled(
      erpPos.map((po) => this.erpService.getPurchaseOrder(String(po.name)))
    )

    return erpPos
      .map((po, i) => {
        const detail = detailResults[i]
        const erp = detail.status === 'fulfilled' ? detail.value : null
        return {
          po_id: String(po.name),
          vendor_id: String(po.supplier || ''),
          vendor_name: String(po.supplier_name || po.supplier || ''),
          erp
        }
      })
      .filter((po) => po.erp !== null)
  }

  async createPurchaseReceipt(user: { user_id: number }, dto: CreatePurchaseReceiptDto) {
    if (!dto.vendor_id || !dto.lines?.length) throw new BadRequestException('vendor_id and lines are required')

    let payload: Record<string, unknown>

    if (dto.po_id) {
      // ── With PO: fetch PO items for cross-referencing ──
      const po = await this.erpService.getPurchaseOrder(dto.po_id)
      const poItemMap = new Map<string, any>()
      ;(Array.isArray((po as any).items) ? (po as any).items : []).forEach((r: any) => { if (r.item_code) poItemMap.set(String(r.item_code), r) })
      payload = {
        supplier: dto.vendor_id, purchase_order: dto.po_id,
        items: dto.lines.map((line) => {
          const pi = poItemMap.get(line.item_code)
          return { item_code: line.item_code, item_name: line.item_name ?? pi?.item_name, uom: line.uom ?? pi?.uom, qty: Number(line.qty), purchase_order: dto.po_id, purchase_order_item: pi?.name }
        })
      }
    } else {
      // ── Without PO: direct receipt ──
      payload = {
        supplier: dto.vendor_id,
        items: dto.lines.map((line) => ({
          item_code: line.item_code,
          item_name: line.item_name,
          uom: line.uom,
          qty: Number(line.qty)
        }))
      }
    }

    const receiptId = await this.erpService.createPurchaseReceipt(payload)
    await this.erpService.submitPurchaseReceipt(receiptId)
    const receipt = this.vendorReceiptRepo.create({
      vendor_id: dto.vendor_id, vendor_name: dto.vendor_name ?? null, po_id: dto.po_id || 'DIRECT', receipt_id: receiptId, created_by: user.user_id,
      lines: dto.lines.map((l) => this.vendorReceiptLineRepo.create({ item_code: l.item_code, item_name: l.item_name ?? null, uom: l.uom ?? null, qty: Number(l.qty) }))
    })
    await this.vendorReceiptRepo.save(receipt)
    return { receipt_id: receiptId }
  }

  async uploadReceiptPhotos(receiptId: string, files: Express.Multer.File[]) {
    const urls: string[] = []
    for (const file of files) {
      const result = await this.erpService.uploadFile(
        file.buffer,
        file.originalname,
        'Purchase Receipt',
        receiptId
      )
      if (result.file_url) urls.push(result.file_url)
    }
    return { uploaded: urls.length, urls }
  }
}
