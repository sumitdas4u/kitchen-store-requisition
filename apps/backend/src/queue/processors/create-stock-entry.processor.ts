import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Injectable } from '@nestjs/common'
import { QUEUE_NAMES } from '../../common/constants'
import { ErpService } from '../../erp/erp.service'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Requisition } from '../../database/entities/requisition.entity'

@Processor(QUEUE_NAMES.CreateStockEntry)
@Injectable()
export class CreateStockEntryProcessor extends WorkerHost {
  constructor(
    private readonly erpService: ErpService,
    @InjectRepository(Requisition)
    private readonly requisitionsRepo: Repository<Requisition>
  ) {
    super()
  }

  async process(job: Job<{ requisitionId: string }>) {
    const { requisitionId } = job.data
    const requisition = await this.requisitionsRepo.findOne({
      where: { id: Number(requisitionId) },
      relations: ['items']
    })
    if (!requisition) {
      throw new Error(`Requisition not found: ${requisitionId}`)
    }

    const activeItems = requisition.items
      .filter((item) => Number(item.received_qty) > 0 || Number(item.issued_qty) > 0)

    const payload = {
      doctype: 'Stock Entry',
      stock_entry_type: 'Material Transfer',
      company: requisition.company,
      docstatus: 0,
      from_warehouse: requisition.source_warehouse,
      to_warehouse: requisition.warehouse,
      remarks: `KR-${requisition.id} | ${requisition.warehouse} | ${requisition.requested_date}`,
      items: activeItems.map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        qty: Number(item.received_qty) > 0 ? Number(item.received_qty) : Number(item.issued_qty),
        uom: item.uom,
        stock_uom: item.uom,
        s_warehouse: requisition.source_warehouse,
        t_warehouse: requisition.warehouse,
        conversion_factor: 1,
        // Link to Material Request at item level
        ...(requisition.erp_name ? { material_request: requisition.erp_name } : {}),
        ...(item.erp_mr_item_name ? { material_request_item: item.erp_mr_item_name } : {})
      }))
    }

    const stockEntryName = await this.erpService.createStockEntryDraft(payload)
    requisition.stock_entry = stockEntryName
    await this.requisitionsRepo.save(requisition)

    return stockEntryName
  }
}
