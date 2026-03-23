import { RequisitionStatus } from '../../common/enums'
import { ErpWriteProcessor } from './erp-write.processor'

function createRepositoryMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn()
  }
}

describe('ErpWriteProcessor', () => {
  it('skips stale create-material-request jobs for requisitions still in draft', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const erpService = {
      createMaterialRequestDraft: jest.fn(),
      findMaterialRequestByLocalId: jest.fn(),
      getMaterialRequest: jest.fn()
    }

    requisitionsRepo.findOne.mockResolvedValue({
      id: 41,
      status: RequisitionStatus.Draft,
      erp_name: null,
      items: []
    })

    const processor = new ErpWriteProcessor(
      erpService as any,
      requisitionsRepo as any,
      requisitionItemsRepo as any
    )

    const result = await processor.process({
      data: {
        action: 'create_material_request',
        payload: {
          requisition_id: 41,
          mr_payload: { custom_local_id: '41' }
        }
      }
    } as any)

    expect(result).toBeNull()
    expect(erpService.createMaterialRequestDraft).not.toHaveBeenCalled()
    expect(requisitionsRepo.update).not.toHaveBeenCalled()
  })

  it('reuses the existing ERP material request when a create job is retried', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const erpService = {
      createMaterialRequestDraft: jest.fn(),
      findMaterialRequestByLocalId: jest.fn().mockResolvedValue({
        name: 'MR-0042',
        docstatus: 0
      }),
      getMaterialRequest: jest.fn().mockResolvedValue({
        items: [{ item_code: 'CHICKEN', name: 'MRI-0042' }]
      })
    }

    requisitionsRepo.findOne.mockResolvedValue({
      id: 42,
      status: RequisitionStatus.Submitted,
      erp_name: null,
      items: [
        {
          id: 4201,
          requisition_id: 42,
          item_code: 'CHICKEN',
          erp_mr_item_name: null
        }
      ]
    })
    requisitionItemsRepo.find.mockResolvedValue([
      {
        id: 4201,
        requisition_id: 42,
        item_code: 'CHICKEN',
        erp_mr_item_name: null
      }
    ])
    requisitionItemsRepo.save.mockImplementation(async (input) => input)

    const processor = new ErpWriteProcessor(
      erpService as any,
      requisitionsRepo as any,
      requisitionItemsRepo as any
    )

    const result = await processor.process({
      data: {
        action: 'create_material_request',
        payload: {
          requisition_id: 42,
          mr_payload: { custom_local_id: '42' }
        }
      }
    } as any)

    expect(result).toBe('MR-0042')
    expect(erpService.createMaterialRequestDraft).not.toHaveBeenCalled()
    expect(requisitionsRepo.update).toHaveBeenCalledWith(42, {
      erp_name: 'MR-0042',
      erp_synced: true,
      last_synced_at: expect.any(Date)
    })
    expect(requisitionItemsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        item_code: 'CHICKEN',
        erp_mr_item_name: 'MRI-0042'
      })
    )
  })
})
