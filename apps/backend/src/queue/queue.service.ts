import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Queue } from 'bullmq'
import { QUEUE_NAMES } from '../common/constants'

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.ErpWrite)
    private readonly erpWriteQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CreateStockEntry)
    private readonly createStockEntryQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CreateStockReconciliation)
    private readonly createStockReconciliationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SendWhatsApp)
    private readonly sendWhatsAppQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SyncItems)
    private readonly syncItemsQueue: Queue
  ) {}

  async enqueueErpWrite<T>(jobName: string, payload: T) {
    return this.erpWriteQueue.add(jobName, payload, {
      attempts: 3,
      backoff: { type: 'fixed', delay: 30000 }
    })
  }

  async enqueueCreateStockEntry(payload: { requisitionId: string }) {
    return this.createStockEntryQueue.add(
      QUEUE_NAMES.CreateStockEntry,
      payload,
      {
        attempts: 3,
        backoff: { type: 'fixed', delay: 30000 }
      }
    )
  }

  async enqueueCreateStockReconciliation(payload: { requisitionId: string }) {
    return this.createStockReconciliationQueue.add(
      QUEUE_NAMES.CreateStockReconciliation,
      payload,
      {
        attempts: 3,
        backoff: { type: 'fixed', delay: 30000 }
      }
    )
  }

  async enqueueWhatsApp(payload: {
    to: string[]
    templateName: string
    params: Record<string, unknown>
  }) {
    return this.sendWhatsAppQueue.add(QUEUE_NAMES.SendWhatsApp, payload, {
      attempts: 3,
      backoff: { type: 'fixed', delay: 60000 }
    })
  }

  async enqueueSyncItems() {
    return this.syncItemsQueue.add(
      QUEUE_NAMES.SyncItems,
      {},
      { repeat: { pattern: '0 4 * * *' } }
    )
  }
}
