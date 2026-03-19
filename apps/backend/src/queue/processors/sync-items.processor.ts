import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Injectable } from '@nestjs/common'
import { QUEUE_NAMES } from '../../common/constants'
import { ErpService } from '../../erp/erp.service'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WarehouseItemGroup } from '../../database/entities/warehouse-item-group.entity'

@Processor(QUEUE_NAMES.SyncItems)
@Injectable()
export class SyncItemsProcessor extends WorkerHost {
  private readonly redis: Redis

  constructor(
    private readonly erpService: ErpService,
    @InjectRepository(WarehouseItemGroup)
    private readonly warehouseGroupsRepo: Repository<WarehouseItemGroup>,
    configService: ConfigService
  ) {
    super()
    this.redis = new Redis({
      host: configService.get<string>('REDIS_HOST'),
      port: Number(configService.get<string>('REDIS_PORT'))
    })
  }

  async process(_job: Job) {
    const groups = await this.warehouseGroupsRepo.find()
    const uniqueGroups = Array.from(new Set(groups.map((g) => g.item_group)))
    if (uniqueGroups.length === 0) {
      return 0
    }
    const items = await this.erpService.getItemsByGroups(uniqueGroups)
    const ttlSeconds = 25 * 60 * 60
    const grouped: Record<string, any[]> = {}
    uniqueGroups.forEach((group) => {
      grouped[group] = []
    })
    items.forEach((item) => {
      if (!grouped[item.item_group]) {
        grouped[item.item_group] = []
      }
      grouped[item.item_group].push(item)
    })
    await Promise.all(
      Object.entries(grouped).map(([group, groupItems]) =>
        this.redis.set(`items:group:${group}`, JSON.stringify(groupItems), 'EX', ttlSeconds)
      )
    )
    return items.length
  }
}
