import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { QUEUE_NAMES } from '../../common/constants'
import { StockEntrySyncStatus } from '../../common/enums'
import { ErpService } from '../../erp/erp.service'
import { Requisition } from '../../database/entities/requisition.entity'
import { RequisitionItem } from '../../database/entities/requisition-item.entity'

type ErpWriteAction =
  | 'submit_stock_entry'
  | 'submit_stock_reconciliation'
  | 'create_material_request'
  | 'update_material_request'
  | 'submit_material_request'
  | 'cancel_material_request'

@Processor(QUEUE_NAMES.ErpWrite)
@Injectable()
export class ErpWriteProcessor extends WorkerHost {
  private readonly logger = new Logger(ErpWriteProcessor.name)

  constructor(
    private readonly erpService: ErpService,
    @InjectRepository(Requisition)
    private readonly requisitionsRepo: Repository<Requisition>,
    @InjectRepository(RequisitionItem)
    private readonly requisitionItemsRepo: Repository<RequisitionItem>
  ) {
    super()
  }

  private extractErpError(error: any, fallback = 'ERP sync failed') {
    const raw = error?.response?.data
    return (
      raw?.exception ||
      raw?.message ||
      (typeof raw === 'string' ? raw : null) ||
      error?.message ||
      fallback
    )
  }

  /**
   * After creating a Material Request in ERPNext, fetch the full MR document
   * to get the child item row names, then store them locally so Stock Entry
   * items can reference them via material_request + material_request_item.
   */
  private async storeMrItemNames(erpName: string, requisitionId: number) {
    try {
      const mrDoc = await this.erpService.getMaterialRequest(erpName)
      if (!mrDoc?.items?.length) return

      const localItems = await this.requisitionItemsRepo.find({
        where: { requisition_id: requisitionId }
      })
      const localMap = new Map(localItems.map((li) => [li.item_code, li]))

      for (const mrItem of mrDoc.items) {
        const local = localMap.get(mrItem.item_code)
        if (local && (mrItem as any).name) {
          local.erp_mr_item_name = (mrItem as any).name
          await this.requisitionItemsRepo.save(local)
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to fetch MR item names for ${erpName}: ${err.message}`)
    }
  }

  async process(
    job: Job<{
      action: ErpWriteAction
      payload: Record<string, unknown>
    }>
  ) {
    const { action, payload } = job.data

    switch (action) {
      case 'submit_stock_entry': {
        const stockEntryName = String(payload.name)
        const requisitionId = Number(payload.requisition_id || 0)

        try {
          await this.erpService.submitStockEntry(stockEntryName)

          if (requisitionId > 0) {
            await this.requisitionsRepo.update(requisitionId, {
              stock_entry_status: StockEntrySyncStatus.Submitted,
              stock_entry_error_message: null,
              stock_entry_last_attempt_at: new Date(),
              erp_synced: true,
              last_synced_at: new Date()
            })
          }

          return
        } catch (error: any) {
          if (requisitionId > 0) {
            await this.requisitionsRepo.update(requisitionId, {
              stock_entry_status: StockEntrySyncStatus.Failed,
              stock_entry_error_message: this.extractErpError(
                error,
                'Failed to submit Stock Entry'
              ),
              stock_entry_last_attempt_at: new Date(),
              erp_synced: false
            })
          }
          throw error
        }
      }

      case 'submit_stock_reconciliation':
        return this.erpService.submitStockReconciliation(String(payload.name))

      case 'create_material_request': {
        const mrPayload = payload.mr_payload as Record<string, unknown>
        const requisitionId = Number(payload.requisition_id)
        const erpName = await this.erpService.createMaterialRequestDraft(mrPayload)
        this.logger.log(`Created MR ${erpName} for requisition ${requisitionId}`)

        // Update local record with ERP name
        await this.requisitionsRepo.update(requisitionId, {
          erp_name: erpName,
          erp_synced: true,
          last_synced_at: new Date()
        })

        // Fetch and store MR item row names for Stock Entry linking
        await this.storeMrItemNames(erpName, requisitionId)

        return erpName
      }

      case 'update_material_request': {
        const erpName = String(payload.erp_name)
        const updatePayload = payload.mr_payload as Record<string, unknown>
        const reqId = Number(payload.requisition_id)
        await this.erpService.updateMaterialRequest(erpName, updatePayload)
        this.logger.log(`Updated MR ${erpName} for requisition ${reqId}`)

        await this.requisitionsRepo.update(reqId, {
          erp_synced: true,
          last_synced_at: new Date()
        })

        // Re-fetch item names in case items changed
        await this.storeMrItemNames(erpName, reqId)

        return
      }

      case 'submit_material_request': {
        const erpName = String(payload.erp_name)
        const reqId = Number(payload.requisition_id)
        await this.erpService.submitMaterialRequest(erpName)
        this.logger.log(`Submitted MR ${erpName} for requisition ${reqId}`)
        await this.requisitionsRepo.update(reqId, {
          erp_synced: true,
          last_synced_at: new Date()
        })
        return
      }

      case 'cancel_material_request': {
        const erpName = String(payload.erp_name)
        await this.erpService.cancelMaterialRequest(erpName)
        this.logger.log(`Cancelled MR ${erpName}`)
        return
      }

      default:
        throw new Error(`Unknown ERP write action: ${action}`)
    }
  }
}
