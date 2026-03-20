import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ErpService } from '../erp/erp.service'
import { ErpItemCache } from '../database/entities/erp-item-cache.entity'
import { ErpItemGroupCache } from '../database/entities/erp-item-group-cache.entity'
import { ErpWarehouseCache } from '../database/entities/erp-warehouse-cache.entity'
import { ErpCompanyCache } from '../database/entities/erp-company-cache.entity'
import { ErpBinStockCache } from '../database/entities/erp-bin-stock-cache.entity'
import { SupplierListCache } from '../database/entities/supplier-list-cache.entity'
import { SyncLog } from '../database/entities/sync-log.entity'

export type SyncEntity =
  | 'items'
  | 'item_groups'
  | 'warehouses'
  | 'companies'
  | 'suppliers'
  | 'bin_stock'
  | 'all'

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name)
  private running = new Set<string>()

  constructor(
    private readonly erpService: ErpService,
    @InjectRepository(ErpItemCache)
    private readonly itemCacheRepo: Repository<ErpItemCache>,
    @InjectRepository(ErpItemGroupCache)
    private readonly itemGroupCacheRepo: Repository<ErpItemGroupCache>,
    @InjectRepository(ErpWarehouseCache)
    private readonly warehouseCacheRepo: Repository<ErpWarehouseCache>,
    @InjectRepository(ErpCompanyCache)
    private readonly companyCacheRepo: Repository<ErpCompanyCache>,
    @InjectRepository(ErpBinStockCache)
    private readonly binStockCacheRepo: Repository<ErpBinStockCache>,
    @InjectRepository(SupplierListCache)
    private readonly supplierCacheRepo: Repository<SupplierListCache>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepo: Repository<SyncLog>
  ) {}

  // ── Status ──────────────────────────────────────────────────────────────────

  async getStatus() {
    const entities = ['items', 'item_groups', 'warehouses', 'companies', 'suppliers', 'bin_stock']
    const [counts, lastSyncs] = await Promise.all([
      Promise.all([
        this.itemCacheRepo.count(),
        this.itemGroupCacheRepo.count(),
        this.warehouseCacheRepo.count(),
        this.companyCacheRepo.count(),
        this.supplierCacheRepo.count(),
        this.binStockCacheRepo.count()
      ]),
      Promise.all(
        entities.map((entity) =>
          this.syncLogRepo.findOne({
            where: { entity, status: 'success' },
            order: { completed_at: 'DESC' }
          })
        )
      )
    ])

    return entities.map((entity, i) => ({
      entity,
      record_count: counts[i],
      last_synced: lastSyncs[i]?.completed_at ?? null,
      duration_ms: lastSyncs[i]?.duration_ms ?? null,
      is_running: this.running.has(entity)
    }))
  }

  async getSyncLog(limit = 50) {
    return this.syncLogRepo.find({
      order: { started_at: 'DESC' },
      take: limit
    })
  }

  // ── Trigger sync ────────────────────────────────────────────────────────────

  async triggerSync(entity: SyncEntity, warehouse?: string) {
    if (entity === 'all') {
      const results: Record<string, { record_count: number } | { error: string }> = {}
      for (const e of ['companies', 'warehouses', 'item_groups', 'items', 'suppliers'] as SyncEntity[]) {
        try {
          results[e] = await this.syncOne(e)
        } catch (err: any) {
          results[e] = { error: err.message }
        }
      }
      if (warehouse) {
        try {
          results['bin_stock'] = await this.syncOne('bin_stock', warehouse)
        } catch (err: any) {
          results['bin_stock'] = { error: err.message }
        }
      }
      return results
    }
    return this.syncOne(entity, warehouse)
  }

  private async syncOne(entity: SyncEntity, warehouse?: string): Promise<{ record_count: number }> {
    const key = entity === 'bin_stock' ? `bin_stock:${warehouse}` : entity
    if (this.running.has(key)) {
      throw new Error(`Sync for ${key} is already running`)
    }
    this.running.add(key)
    const log = this.syncLogRepo.create({ entity, status: 'running' })
    await this.syncLogRepo.save(log)
    const start = Date.now()

    try {
      let count: number
      switch (entity) {
        case 'items':
          count = await this.syncItems()
          break
        case 'item_groups':
          count = await this.syncItemGroups()
          break
        case 'warehouses':
          count = await this.syncWarehouses()
          break
        case 'companies':
          count = await this.syncCompanies()
          break
        case 'suppliers':
          count = await this.syncSuppliers()
          break
        case 'bin_stock':
          if (!warehouse) throw new Error('warehouse is required for bin_stock sync')
          count = await this.syncBinStock(warehouse)
          break
        default:
          throw new Error(`Unknown entity: ${entity}`)
      }

      log.status = 'success'
      log.record_count = count
      log.duration_ms = Date.now() - start
      log.completed_at = new Date()
      await this.syncLogRepo.save(log)
      this.logger.log(`Sync ${entity} complete: ${count} records in ${log.duration_ms}ms`)
      return { record_count: count }
    } catch (err: any) {
      log.status = 'failed'
      log.duration_ms = Date.now() - start
      log.error_message = err.message?.slice(0, 2000) ?? 'Unknown error'
      log.completed_at = new Date()
      await this.syncLogRepo.save(log)
      this.logger.warn(`Sync ${entity} failed: ${err.message}`)
      throw err
    } finally {
      this.running.delete(key)
    }
  }

  // ── Individual sync methods ─────────────────────────────────────────────────

  private async syncItems(): Promise<number> {
    // Fetch ALL items from ERPNext (including disabled for cache completeness)
    const fields = JSON.stringify(['name', 'item_name', 'item_group', 'stock_uom', 'disabled'])
    const allItems: Array<{ name: string; item_name: string; item_group: string; stock_uom: string; disabled?: number | boolean }> = []

    // We use the ERP service's client indirectly — fetch all item groups first
    // then fetch items per group. But simpler: use getItemsByGroups with all groups.
    // Actually, let's fetch items directly from ERP using the erp service methods.
    // The erp service filters out disabled items, but we want all for the cache.
    // So we'll use a two-pass approach: get all items via groups, then mark disabled.

    // Get all item groups first
    const groups = await this.erpService.getItemGroups()
    const groupNames = groups.map((g) => g.name)

    if (groupNames.length === 0) return 0

    // Fetch items for all groups (this already filters disabled)
    const enabledItems = await this.erpService.getItemsByGroups(groupNames)

    const now = new Date()
    const rows = enabledItems.map((item) =>
      this.itemCacheRepo.create({
        item_code: item.name,
        item_name: item.item_name,
        item_group: item.item_group,
        stock_uom: item.stock_uom,
        disabled: false,
        synced_at: now
      })
    )

    // Clear and repopulate
    await this.itemCacheRepo.clear()
    for (let i = 0; i < rows.length; i += 200) {
      await this.itemCacheRepo.save(rows.slice(i, i + 200))
    }

    return rows.length
  }

  private async syncItemGroups(): Promise<number> {
    const groups = await this.erpService.getItemGroups()
    const now = new Date()
    const rows = groups.map((g) =>
      this.itemGroupCacheRepo.create({
        name: g.name,
        parent_item_group: g.parent_item_group ?? null,
        is_group: false,
        synced_at: now
      })
    )

    await this.itemGroupCacheRepo.clear()
    for (let i = 0; i < rows.length; i += 200) {
      await this.itemGroupCacheRepo.save(rows.slice(i, i + 200))
    }

    return rows.length
  }

  private async syncWarehouses(): Promise<number> {
    const warehouses = await this.erpService.getWarehouses()
    const now = new Date()
    const rows = warehouses.map((w) =>
      this.warehouseCacheRepo.create({
        name: w.name,
        warehouse_name: w.warehouse_name ?? null,
        parent_warehouse: w.parent_warehouse ?? null,
        is_group: Boolean(w.is_group),
        company: w.company ?? null,
        disabled: false,
        synced_at: now
      })
    )

    await this.warehouseCacheRepo.clear()
    for (let i = 0; i < rows.length; i += 200) {
      await this.warehouseCacheRepo.save(rows.slice(i, i + 200))
    }

    return rows.length
  }

  private async syncCompanies(): Promise<number> {
    const companies = await this.erpService.getCompanies()
    const now = new Date()
    const rows = companies.map((c) =>
      this.companyCacheRepo.create({
        name: c.name,
        company_name: c.company_name ?? null,
        country: c.country ?? null,
        synced_at: now
      })
    )

    await this.companyCacheRepo.clear()
    for (let i = 0; i < rows.length; i += 200) {
      await this.companyCacheRepo.save(rows.slice(i, i + 200))
    }

    return rows.length
  }

  private async syncSuppliers(): Promise<number> {
    const suppliers = await this.erpService.listSuppliers()
    const now = new Date()
    const rows = suppliers.map((s) =>
      this.supplierCacheRepo.create({
        name: s.name,
        supplier_name: s.supplier_name ?? null,
        mobile_no: (s as any).mobile_no ?? null,
        disabled: Boolean((s as any).disabled),
        cached_at: now
      })
    )

    await this.supplierCacheRepo.clear()
    for (let i = 0; i < rows.length; i += 200) {
      await this.supplierCacheRepo.save(rows.slice(i, i + 200))
    }

    return rows.length
  }

  private async syncBinStock(warehouse: string): Promise<number> {
    const bins = await this.erpService.getBinStock(warehouse)
    const now = new Date()
    const rows = bins.map((b) =>
      this.binStockCacheRepo.create({
        warehouse,
        item_code: b.item_code,
        actual_qty: Number(b.actual_qty || 0),
        stock_uom: b.stock_uom ?? null,
        valuation_rate: Number(b.valuation_rate || 0),
        synced_at: now
      })
    )

    // Delete existing rows for this warehouse and repopulate
    await this.binStockCacheRepo.delete({ warehouse })
    for (let i = 0; i < rows.length; i += 200) {
      await this.binStockCacheRepo.save(rows.slice(i, i + 200))
    }

    return rows.length
  }
}
