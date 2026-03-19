import { BadRequestException, Injectable } from '@nestjs/common'
import { ErpService } from '../erp/erp.service'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { createHash } from 'crypto'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WarehouseItemGroup } from '../database/entities/warehouse-item-group.entity'
import { WarehouseItem } from '../database/entities/warehouse-item.entity'
import { RequisitionService } from '../requisition/requisition.service'

@Injectable()
export class KitchenService {
  private readonly redis: Redis

  constructor(
    private readonly erpService: ErpService,
    private readonly requisitionService: RequisitionService,
    @InjectRepository(WarehouseItemGroup)
    private readonly warehouseGroupsRepo: Repository<WarehouseItemGroup>,
    @InjectRepository(WarehouseItem)
    private readonly warehouseItemsRepo: Repository<WarehouseItem>,
    configService: ConfigService
  ) {
    this.redis = new Redis({
      host: configService.get<string>('REDIS_HOST'),
      port: Number(configService.get<string>('REDIS_PORT'))
    })
  }

  async getItemsForWarehouse(
    warehouse: string | null | undefined,
    company: string
  ) {
    if (!warehouse) {
      throw new BadRequestException(
        'Warehouse is required when accessing kitchen items without login'
      )
    }

    const mappedItems = await this.warehouseItemsRepo.find({
      where: { warehouse }
    })
    const itemCodes = mappedItems.map((row) => row.item_code)
    let itemsFromCodes: any[] = []
    if (itemCodes.length > 0) {
      const codeKey = itemCodes.slice().sort().join('|')
      const hash = createHash('sha1').update(codeKey).digest('hex')
      const cacheKey = `items:warehouse:${warehouse}:codes:${hash}`
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        itemsFromCodes = JSON.parse(cached) as any[]
      } else {
        const fetched = await this.erpService.getItemsByCodes(itemCodes)
        const ttlSeconds = 25 * 60 * 60
        await this.redis.set(cacheKey, JSON.stringify(fetched), 'EX', ttlSeconds)
        itemsFromCodes = fetched
      }
    }

    const groups = await this.warehouseGroupsRepo.find({
      where: { warehouse }
    })
    const itemGroups = groups.map((g) => g.item_group)
    const cachedItems: Record<string, any[]> = {}
    let itemsFromGroups: any[] = []
    if (itemGroups.length > 0) {
      const cacheKeys = itemGroups.map((group) => `items:group:${group}`)
      const cached = await this.redis.mget(cacheKeys)
      const missingGroups: string[] = []

      itemGroups.forEach((group, index) => {
        const entry = cached[index]
        if (entry) {
          cachedItems[group] = JSON.parse(entry)
        } else {
          missingGroups.push(group)
        }
      })

      if (missingGroups.length > 0) {
        const fetched = await this.erpService.getItemsByGroups(missingGroups)
        const grouped: Record<string, any[]> = {}
        missingGroups.forEach((group) => {
          grouped[group] = []
        })
        fetched.forEach((item) => {
          if (!grouped[item.item_group]) {
            grouped[item.item_group] = []
          }
          grouped[item.item_group].push(item)
        })
        const ttlSeconds = 25 * 60 * 60
        await Promise.all(
          Object.entries(grouped).map(([group, items]) =>
            this.redis.set(`items:group:${group}`, JSON.stringify(items), 'EX', ttlSeconds)
          )
        )
        missingGroups.forEach((group) => {
          cachedItems[group] = grouped[group] || []
        })
      }

      itemsFromGroups = itemGroups.flatMap((group) => cachedItems[group] || [])
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

    const mappedItems = await this.warehouseItemsRepo.find({
      where: { warehouse }
    })
    const itemCodes = mappedItems.map((row) => row.item_code)
    if (itemCodes.length === 0) {
      return []
    }
    const items = await this.erpService.getItemsByCodes(itemCodes)
    const inferredGroups = Array.from(
      new Set(items.map((item) => item.item_group).filter(Boolean))
    )
    return inferredGroups.sort((a, b) => a.localeCompare(b))
  }

  async getStockForWarehouse(warehouse: string | null | undefined) {
    if (!warehouse) {
      throw new BadRequestException(
        'Warehouse is required when accessing kitchen stock without login'
      )
    }
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
}
