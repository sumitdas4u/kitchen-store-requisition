import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Injectable } from '@nestjs/common'
import { QUEUE_NAMES } from '../../common/constants'
import { ErpService } from '../../erp/erp.service'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Requisition } from '../../database/entities/requisition.entity'

@Processor(QUEUE_NAMES.CreateStockReconciliation)
@Injectable()
export class CreateStockReconciliationProcessor extends WorkerHost {
  constructor(
    private readonly erpService: ErpService,
    @InjectRepository(Requisition)
    private readonly requisitionsRepo: Repository<Requisition>
  ) {
    super()
  }

  async process(job: Job<{ requisitionId: string }>) {
    const requisition = await this.requisitionsRepo.findOne({
      where: { id: Number(job.data.requisitionId) },
      relations: ['items']
    })
    if (!requisition) {
      return
    }

    const items = requisition.items
      .filter((item) => item.actual_closing !== null && item.actual_closing !== undefined)
      .filter(
        (item) =>
          Number(item.actual_closing) !== Number(item.closing_stock)
      )
      .map((item) => ({
        item_code: item.item_code,
        warehouse: requisition.warehouse,
        qty: Number(item.actual_closing)
      }))

    if (items.length === 0) {
      return
    }

    const name = await this.erpService.createStockReconciliationDraft({
      doctype: 'Stock Reconciliation',
      company: requisition.company,
      docstatus: 0,
      purpose: 'Stock Reconciliation',
      items
    })
    if (name) {
      await this.erpService.submitStockReconciliation(name)
    }
  }
}
