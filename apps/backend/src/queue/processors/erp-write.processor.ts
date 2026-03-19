import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Injectable } from '@nestjs/common'
import { QUEUE_NAMES } from '../../common/constants'
import { ErpService } from '../../erp/erp.service'

@Processor(QUEUE_NAMES.ErpWrite)
@Injectable()
export class ErpWriteProcessor extends WorkerHost {
  constructor(private readonly erpService: ErpService) {
    super()
  }

  async process(
    job: Job<{
      action: 'submit_stock_entry' | 'submit_stock_reconciliation'
      payload: Record<string, unknown>
    }>
  ) {
    const { action, payload } = job.data

    switch (action) {
      case 'submit_stock_entry':
        return this.erpService.submitStockEntry(String(payload.name))
      case 'submit_stock_reconciliation':
        return this.erpService.submitStockReconciliation(String(payload.name))
      default:
        throw new Error(`Unknown ERP write action: ${action}`)
    }
  }
}
