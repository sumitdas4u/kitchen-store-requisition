import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ErpService } from '../erp/erp.service'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { WarehouseItemGroup } from '../database/entities/warehouse-item-group.entity'
import { WarehouseItem } from '../database/entities/warehouse-item.entity'
import { ErpItemCache } from '../database/entities/erp-item-cache.entity'
import { ErpBinStockCache } from '../database/entities/erp-bin-stock-cache.entity'
import { RequisitionService } from '../requisition/requisition.service'

@Injectable()
export class KitchenService {
  private readonly logger = new Logger(KitchenService.name)

  constructor(
    private readonly erpService: ErpService,
    private readonly requisitionService: RequisitionService,
    @InjectRepository(WarehouseItemGroup)
    private readonly warehouseGroupsRepo: Repository<WarehouseItemGroup>,
    @InjectRepository(WarehouseItem)
    private readonly warehouseItemsRepo: Repository<WarehouseItem>,
    @InjectRepository(ErpItemCache)
    private readonly itemCacheRepo: Repository<ErpItemCache>,
    @InjectRepository(ErpBinStockCache)
    private readonly binStockCacheRepo: Repository<ErpBinStockCache>
  ) {}

  async getItemsForWarehouse(
    warehouse: string | null | undefined,
    company: string
  ) {
    if (!warehouse) {
      throw new BadRequestException(
        'Warehouse is required when accessing kitchen items without login'
      )
    }

    // 1. Get directly mapped item codes for this warehouse
    const mappedItems = await this.warehouseItemsRepo.find({
      where: { warehouse }
    })
    const directCodes = mappedItems.map((row) => row.item_code)

    // 2. Get item groups mapped to this warehouse
    const groups = await this.warehouseGroupsRepo.find({
      where: { warehouse }
    })
    const itemGroups = groups.map((g) => g.item_group)

    // 3. Fetch items from local cache (DB) instead of ERPNext
    const itemsFromCodes = directCodes.length > 0
      ? await this.itemCacheRepo.find({
          where: { item_code: In(directCodes), disabled: false }
        })
      : []

    let itemsFromGroups: ErpItemCache[] = []
    if (itemGroups.length > 0) {
      itemsFromGroups = await this.itemCacheRepo
        .createQueryBuilder('i')
        .where('i.item_group IN (:...groups)', { groups: itemGroups })
        .andWhere('i.disabled = false')
        .getMany()
    }

    // 4. Merge items (deduplicate by item_code)
    const merged = new Map<string, ErpItemCache>()
    itemsFromCodes.forEach((item) => merged.set(item.item_code, item))
    itemsFromGroups.forEach((item) => merged.set(item.item_code, item))

    if (merged.size === 0) {
      // Fallback: if cache is empty, try live ERP (first-time before sync)
      return this.getItemsFromErpFallback(warehouse, directCodes, itemGroups)
    }

    // 5. Get stock from local bin cache, fallback to live ERP
    const stockMap = await this.getStockMap(warehouse)

    return Array.from(merged.values()).map((item) => {
      const stock = stockMap.get(item.item_code)
      return {
        name: item.item_code,
        item_name: item.item_name,
        item_group: item.item_group,
        stock_uom: item.stock_uom,
        actual_qty: stock?.actual_qty ?? 0,
        valuation_rate: stock?.valuation_rate ?? 0
      }
    })
  }

  async getItemGroupsForWarehouse(
    warehouse: string | null | undefined,
    company: string
  ) {
    if (!warehouse) {
      throw new BadRequestException(
        'Warehouse is required when accessing kitchen item groups without login'
      )
    }
    const groups = await this.warehouseGroupsRepo.find({
      where: company ? { warehouse, company } : { warehouse }
    })
    const groupNames = groups.map((g) => g.item_group)
    const uniqueGroups = Array.from(new Set(groupNames))
    if (uniqueGroups.length > 0) {
      return uniqueGroups.sort((a, b) => a.localeCompare(b))
    }

    // Infer groups from directly mapped items via local cache
    const mappedItems = await this.warehouseItemsRepo.find({
      where: { warehouse }
    })
    const itemCodes = mappedItems.map((row) => row.item_code)
    if (itemCodes.length === 0) {
      return []
    }

    const items = await this.itemCacheRepo.find({
      where: { item_code: In(itemCodes), disabled: false }
    })

    if (items.length === 0) {
      // Fallback to live ERP if cache is empty
      const erpItems = await this.erpService.getItemsByCodes(itemCodes)
      const inferredGroups = Array.from(
        new Set(erpItems.map((item) => item.item_group).filter(Boolean))
      )
      return inferredGroups.sort((a, b) => a.localeCompare(b))
    }

    const inferredGroups = Array.from(
      new Set(items.map((item) => item.item_group).filter(Boolean) as string[])
    )
    return inferredGroups.sort((a, b) => a.localeCompare(b))
  }

  async getStockForWarehouse(warehouse: string | null | undefined) {
    if (!warehouse) {
      throw new BadRequestException(
        'Warehouse is required when accessing kitchen stock without login'
      )
    }

    // Try local cache first
    const cached = await this.binStockCacheRepo.find({ where: { warehouse } })
    if (cached.length > 0) {
      return cached.map((row) => ({
        item_code: row.item_code,
        actual_qty: Number(row.actual_qty),
        stock_uom: row.stock_uom,
        valuation_rate: Number(row.valuation_rate)
      }))
    }

    // Fallback to live ERP
    return this.erpService.getBinStock(warehouse)
  }

  async listRequisitions(warehouse: string | null | undefined) {
    if (!warehouse) {
      throw new BadRequestException(
        'Warehouse is required when accessing kitchen requisitions without login'
      )
    }
    return this.requisitionService.listByWarehouse(warehouse)
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getStockMap(warehouse: string): Promise<Map<string, { actual_qty: number; valuation_rate: number }>> {
    // Try local bin stock cache first
    const cached = await this.binStockCacheRepo.find({ where: { warehouse } })
    if (cached.length > 0) {
      return new Map(
        cached.map((row) => [
          row.item_code,
          { actual_qty: Number(row.actual_qty), valuation_rate: Number(row.valuation_rate) }
        ])
      )
    }

    // Fallback to live ERP if cache is empty (before first sync)
    this.logger.warn(`Bin stock cache empty for ${warehouse}, falling back to live ERP`)
    const stockRows = await this.erpService.getBinStock(warehouse)
    return new Map(
      stockRows.map((row) => [
        row.item_code,
        { actual_qty: Number(row.actual_qty ?? 0), valuation_rate: Number(row.valuation_rate ?? 0) }
      ])
    )
  }

  private async getItemsFromErpFallback(
    warehouse: string,
    directCodes: string[],
    itemGroups: string[]
  ) {
    this.logger.warn('Item cache empty, falling back to live ERP')
    let itemsFromCodes: any[] = []
    if (directCodes.length > 0) {
      itemsFromCodes = await this.erpService.getItemsByCodes(directCodes)
    }

    let itemsFromGroups: any[] = []
    if (itemGroups.length > 0) {
      itemsFromGroups = await this.erpService.getItemsByGroups(itemGroups)
    }

    const merged = new Map<string, any>()
    itemsFromCodes.forEach((item) => merged.set(item.name, item))
    itemsFromGroups.forEach((item) => merged.set(item.name, item))

    const stockRows = await this.erpService.getBinStock(warehouse)
    const stockMap = new Map(
      stockRows.map((row) => [row.item_code, row])
    )

    return Array.from(merged.values()).map((item) => {
      const stock = stockMap.get(item.name)
      return {
        ...item,
        actual_qty: stock?.actual_qty ?? 0,
        valuation_rate: stock?.valuation_rate ?? 0
      }
    })
  }
}
