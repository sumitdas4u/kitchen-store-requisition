import { RequisitionService } from './requisition.service'
import { RequisitionStatus } from '../common/enums'

function createRepositoryMock() {
  return {
    delete: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn()
  }
}

describe('RequisitionService', () => {
  it('returns only requisitions that still need store action in listForStore', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const warehouseCacheRepo = createRepositoryMock()
    const queueService = {
      enqueueCreateStockEntry: jest.fn(),
      enqueueCreateStockReconciliation: jest.fn(),
      enqueueErpWrite: jest.fn()
    }
    const notificationsService = {
      notifyStatusChange: jest.fn()
    }
    const erpService = {
      createMaterialRequestDraft: jest.fn()
    }

    requisitionsRepo.find.mockResolvedValue([
      {
        id: 1,
        status: RequisitionStatus.Submitted,
        requested_date: '2026-03-23',
        items: [{ requested_qty: 2, received_qty: 0 }]
      },
      {
        id: 2,
        status: RequisitionStatus.Submitted,
        requested_date: '2026-03-23',
        items: [{ requested_qty: 0, received_qty: 0 }]
      },
      {
        id: 3,
        status: RequisitionStatus.PartiallyIssued,
        requested_date: '2026-03-23',
        items: [{ requested_qty: 1, received_qty: 1 }]
      },
      {
        id: 4,
        status: RequisitionStatus.PartiallyIssued,
        requested_date: '2026-03-23',
        items: [{ requested_qty: 3, received_qty: 1 }]
      }
    ])

    const service = new RequisitionService(
      requisitionsRepo as any,
      requisitionItemsRepo as any,
      createRepositoryMock() as any,
      warehouseCacheRepo as any,
      queueService as any,
      notificationsService as any,
      erpService as any
    )

    const result = await service.listForStore()

    expect(requisitionsRepo.find).toHaveBeenCalledWith({
      where: [
        { status: RequisitionStatus.Submitted },
        { status: RequisitionStatus.PartiallyIssued }
      ],
      relations: ['items'],
      order: { requested_date: 'DESC' }
    })
    expect(result.map((row) => row.id)).toEqual([1, 4])
    expect(result[0].items).toEqual([{ requested_qty: 2, received_qty: 0 }])
  })

  it('marks a requisition as issued and creates an ERP stock entry when the store issues the full request', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const warehouseCacheRepo = createRepositoryMock()
    const queueService = {
      enqueueCreateStockEntry: jest.fn(),
      enqueueCreateStockReconciliation: jest.fn(),
      enqueueErpWrite: jest.fn()
    }
    const notificationsService = {
      notifyStatusChange: jest.fn()
    }
    const erpService = {
      getBinStock: jest.fn().mockResolvedValue([
        { item_code: 'CHICKEN', actual_qty: 3 }
      ]),
      createMaterialRequestDraft: jest.fn(),
      createStockEntryDraft: jest.fn().mockResolvedValue('STE-0001')
    }
    const requisition = {
      id: 1,
      status: RequisitionStatus.Submitted,
      company: 'Food Studio',
      warehouse: 'Chinese Kitchen',
      source_warehouse: 'Stores - MAIN',
      requested_date: '2026-03-23',
      erp_name: 'MR-0001',
      erp_synced: false,
      store_note: null as string | null,
      stock_entry: null as string | null,
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          uom: 'Kg',
          requested_qty: 3,
          issued_qty: 0,
          received_qty: 0,
          item_status: 'Pending',
          erp_mr_item_name: 'MRI-0001'
        }
      ]
    }

    requisitionsRepo.findOne.mockResolvedValue(requisition)
    requisitionsRepo.save.mockImplementation(async (input) => input)
    requisitionItemsRepo.save.mockImplementation(async (input) => input)
    warehouseCacheRepo.find.mockResolvedValue([])

    const service = new RequisitionService(
      requisitionsRepo as any,
      requisitionItemsRepo as any,
      createRepositoryMock() as any,
      warehouseCacheRepo as any,
      queueService as any,
      notificationsService as any,
      erpService as any
    )

    const result = await service.issue(1, {
      items: [{ item_code: 'CHICKEN', issued_qty: 3 }],
      store_note: 'Issue full qty'
    })

    expect(result).toEqual({ ok: true, status: RequisitionStatus.Issued })
    expect(requisition.status).toBe(RequisitionStatus.Issued)
    expect(requisition.store_note).toBe('Issue full qty')
    expect(requisition.stock_entry).toBe('STE-0001')
    expect((requisition as any).stock_entry_status).toBe('draft_created')
    expect(requisition.items[0]).toMatchObject({
      issued_qty: 3,
      item_status: 'Issued'
    })
    expect(erpService.createStockEntryDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        company: 'Food Studio',
        from_warehouse: 'Stores - MAIN',
        to_warehouse: 'Chinese Kitchen',
        items: [
          expect.objectContaining({
            item_code: 'CHICKEN',
            qty: 3,
            material_request: 'MR-0001',
            material_request_item: 'MRI-0001'
          })
        ]
      })
    )
    expect(notificationsService.notifyStatusChange).toHaveBeenCalledWith(
      '1',
      RequisitionStatus.Issued
    )
  })

  it('blocks store issue when source warehouse stock is lower than the issued qty', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const warehouseCacheRepo = createRepositoryMock()
    const queueService = {
      enqueueCreateStockEntry: jest.fn(),
      enqueueCreateStockReconciliation: jest.fn(),
      enqueueErpWrite: jest.fn()
    }
    const notificationsService = {
      notifyStatusChange: jest.fn()
    }
    const erpService = {
      getBinStock: jest.fn().mockResolvedValue([
        { item_code: 'CHICKEN', actual_qty: 1 }
      ]),
      createMaterialRequestDraft: jest.fn(),
      createStockEntryDraft: jest.fn()
    }
    const requisition = {
      id: 11,
      status: RequisitionStatus.Submitted,
      company: 'Food Studio',
      warehouse: 'Chinese Kitchen',
      source_warehouse: 'Stores - MAIN',
      requested_date: '2026-03-23',
      erp_name: 'MR-0011',
      erp_synced: false,
      stock_entry: null,
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          uom: 'Kg',
          requested_qty: 3,
          issued_qty: 0,
          received_qty: 0,
          item_status: 'Pending',
          erp_mr_item_name: 'MRI-0011'
        }
      ]
    }

    requisitionsRepo.findOne.mockResolvedValue(requisition)

    const service = new RequisitionService(
      requisitionsRepo as any,
      requisitionItemsRepo as any,
      createRepositoryMock() as any,
      warehouseCacheRepo as any,
      queueService as any,
      notificationsService as any,
      erpService as any
    )

    await expect(
      service.issue(11, {
        items: [{ item_code: 'CHICKEN', issued_qty: 2 }]
      })
    ).rejects.toThrow('Cannot issue 2 of CHICKEN. Only 1 available in Stores - MAIN')
  })

  it('keeps the requisition partially issued when the kitchen confirms a partial receipt', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const warehouseCacheRepo = createRepositoryMock()
    const queueService = {
      enqueueCreateStockEntry: jest.fn(),
      enqueueCreateStockReconciliation: jest.fn(),
      enqueueErpWrite: jest.fn()
    }
    const notificationsService = {
      notifyStatusChange: jest.fn()
    }
    const erpService = {
      createMaterialRequestDraft: jest.fn()
    }
    const requisition = {
      id: 2,
      status: RequisitionStatus.Issued,
      requested_date: '2026-03-23',
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          uom: 'Kg',
          requested_qty: 3,
          issued_qty: 3,
          received_qty: 0,
          item_status: 'Issued'
        }
      ]
    }

    requisitionsRepo.findOne.mockResolvedValue(requisition)
    requisitionsRepo.save.mockImplementation(async (input) => input)
    requisitionItemsRepo.save.mockImplementation(async (input) => input)

    const service = new RequisitionService(
      requisitionsRepo as any,
      requisitionItemsRepo as any,
      createRepositoryMock() as any,
      warehouseCacheRepo as any,
      queueService as any,
      notificationsService as any,
      erpService as any
    )

    const result = await service.confirm(2, {
      items: [{ item_code: 'CHICKEN', received_qty: 2, action: 'partial' }]
    })

    expect(result).toEqual({ ok: true, status: RequisitionStatus.PartiallyIssued })
    expect(requisition.status).toBe(RequisitionStatus.PartiallyIssued)
    expect(requisition.items[0]).toMatchObject({
      received_qty: 2,
      item_status: 'Partially Issued'
    })
    expect(notificationsService.notifyStatusChange).toHaveBeenCalledWith(
      '2',
      RequisitionStatus.PartiallyIssued
    )
  })

  it('auto-completes a requisition on full receipt and submits the stock entry draft', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const warehouseCacheRepo = createRepositoryMock()
    const queueService = {
      enqueueCreateStockEntry: jest.fn(),
      enqueueCreateStockReconciliation: jest.fn(),
      enqueueErpWrite: jest.fn()
    }
    const notificationsService = {
      notifyStatusChange: jest.fn()
    }
    const erpService = {
      createMaterialRequestDraft: jest.fn()
    }
    const requisition = {
      id: 3,
      status: RequisitionStatus.Issued,
      stock_entry: 'STE-0009',
      completed_at: null as Date | null,
      requested_date: '2026-03-23',
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          uom: 'Kg',
          requested_qty: 3,
          issued_qty: 3,
          received_qty: 0,
          item_status: 'Issued'
        }
      ]
    }

    requisitionsRepo.findOne.mockResolvedValue(requisition)
    requisitionsRepo.save.mockImplementation(async (input) => input)
    requisitionItemsRepo.save.mockImplementation(async (input) => input)

    const service = new RequisitionService(
      requisitionsRepo as any,
      requisitionItemsRepo as any,
      createRepositoryMock() as any,
      warehouseCacheRepo as any,
      queueService as any,
      notificationsService as any,
      erpService as any
    )

    const result = await service.confirm(3, {
      items: [{ item_code: 'CHICKEN', received_qty: 3, action: 'accept' }]
    })

    expect(result).toEqual({ ok: true, status: RequisitionStatus.Completed })
    expect(requisition.status).toBe(RequisitionStatus.Completed)
    expect(requisition.completed_at).toBeInstanceOf(Date)
    expect(requisition.items[0]).toMatchObject({
      received_qty: 3,
      item_status: 'Issued'
    })
    expect(queueService.enqueueErpWrite).toHaveBeenCalledWith(
      'submit_stock_entry',
      {
        action: 'submit_stock_entry',
        payload: { name: 'STE-0009', requisition_id: 3 }
      }
    )
    expect(notificationsService.notifyStatusChange).toHaveBeenCalledWith(
      '3',
      RequisitionStatus.Completed
    )
  })

  it('does not re-notify when confirm stays partially issued', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const warehouseCacheRepo = createRepositoryMock()
    const queueService = {
      enqueueCreateStockEntry: jest.fn(),
      enqueueCreateStockReconciliation: jest.fn(),
      enqueueErpWrite: jest.fn()
    }
    const notificationsService = {
      notifyStatusChange: jest.fn()
    }
    const erpService = {
      createMaterialRequestDraft: jest.fn()
    }
    const requisition = {
      id: 4,
      status: RequisitionStatus.PartiallyIssued,
      stock_entry: 'STE-0010',
      completed_at: null as Date | null,
      requested_date: '2026-03-23',
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          uom: 'Kg',
          requested_qty: 3,
          issued_qty: 3,
          received_qty: 1,
          item_status: 'Partially Issued'
        }
      ]
    }

    requisitionsRepo.findOne.mockResolvedValue(requisition)
    requisitionsRepo.save.mockImplementation(async (input) => input)
    requisitionItemsRepo.save.mockImplementation(async (input) => input)

    const service = new RequisitionService(
      requisitionsRepo as any,
      requisitionItemsRepo as any,
      createRepositoryMock() as any,
      warehouseCacheRepo as any,
      queueService as any,
      notificationsService as any,
      erpService as any
    )

    const result = await service.confirm(4, {
      items: [{ item_code: 'CHICKEN', received_qty: 2, action: 'partial' }]
    })

    expect(result).toEqual({ ok: true, status: RequisitionStatus.PartiallyIssued })
    expect(requisition.items[0]).toMatchObject({
      received_qty: 2,
      item_status: 'Partially Issued'
    })
    expect(notificationsService.notifyStatusChange).not.toHaveBeenCalled()
  })

  it('keeps rejected lines partial until the requisition is explicitly finalized', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const warehouseCacheRepo = createRepositoryMock()
    const queueService = {
      enqueueCreateStockEntry: jest.fn(),
      enqueueCreateStockReconciliation: jest.fn(),
      enqueueErpWrite: jest.fn()
    }
    const notificationsService = {
      notifyStatusChange: jest.fn()
    }
    const erpService = {
      createMaterialRequestDraft: jest.fn()
    }
    const requisition = {
      id: 5,
      status: RequisitionStatus.Issued,
      stock_entry: 'STE-0011',
      completed_at: null as Date | null,
      requested_date: '2026-03-23',
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          uom: 'Kg',
          requested_qty: 3,
          issued_qty: 3,
          received_qty: 0,
          item_status: 'Issued'
        }
      ]
    }

    requisitionsRepo.findOne.mockResolvedValue(requisition)
    requisitionsRepo.save.mockImplementation(async (input) => input)
    requisitionItemsRepo.save.mockImplementation(async (input) => input)

    const service = new RequisitionService(
      requisitionsRepo as any,
      requisitionItemsRepo as any,
      createRepositoryMock() as any,
      warehouseCacheRepo as any,
      queueService as any,
      notificationsService as any,
      erpService as any
    )

    const result = await service.confirm(5, {
      items: [{ item_code: 'CHICKEN', received_qty: 0, action: 'reject' }]
    })

    expect(result).toEqual({ ok: true, status: RequisitionStatus.PartiallyIssued })
    expect(requisition.items[0]).toMatchObject({
      received_qty: 0,
      item_status: 'Rejected'
    })
    expect(queueService.enqueueErpWrite).not.toHaveBeenCalled()
  })

  it('retries a failed stock entry submission and marks it submitted on success', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const warehouseCacheRepo = createRepositoryMock()
    const queueService = {
      enqueueCreateStockEntry: jest.fn(),
      enqueueCreateStockReconciliation: jest.fn(),
      enqueueErpWrite: jest.fn()
    }
    const notificationsService = {
      notifyStatusChange: jest.fn()
    }
    const erpService = {
      createMaterialRequestDraft: jest.fn(),
      submitStockEntry: jest.fn().mockResolvedValue(undefined)
    }
    const requisition = {
      id: 12,
      status: RequisitionStatus.Completed,
      company: 'Food Studio',
      warehouse: 'Chinese Kitchen',
      source_warehouse: 'Stores - MAIN',
      requested_date: '2026-03-23',
      stock_entry: 'STE-0012',
      stock_entry_status: 'failed',
      stock_entry_error_message: 'ERP timeout',
      completed_at: new Date('2026-03-23T10:00:00.000Z'),
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          uom: 'Kg',
          requested_qty: 3,
          issued_qty: 3,
          received_qty: 3,
          item_status: 'Issued'
        }
      ]
    }

    requisitionsRepo.findOne.mockResolvedValue(requisition)
    requisitionsRepo.save.mockImplementation(async (input) => input)
    warehouseCacheRepo.find.mockResolvedValue([])

    const service = new RequisitionService(
      requisitionsRepo as any,
      requisitionItemsRepo as any,
      createRepositoryMock() as any,
      warehouseCacheRepo as any,
      queueService as any,
      notificationsService as any,
      erpService as any
    )

    const result = await service.retryStockEntry(12)

    expect(result).toEqual({
      success: true,
      stock_entry: 'STE-0012',
      stock_entry_status: 'submitted'
    })
    expect(erpService.submitStockEntry).toHaveBeenCalledWith('STE-0012')
    expect(requisition.stock_entry_status).toBe('submitted')
    expect(requisition.stock_entry_error_message).toBeNull()
  })

  it('rejects over-receive quantities that exceed the requested quantity', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const warehouseCacheRepo = createRepositoryMock()
    const queueService = {
      enqueueCreateStockEntry: jest.fn(),
      enqueueCreateStockReconciliation: jest.fn(),
      enqueueErpWrite: jest.fn()
    }
    const notificationsService = {
      notifyStatusChange: jest.fn()
    }
    const erpService = {
      createMaterialRequestDraft: jest.fn()
    }
    const requisition = {
      id: 6,
      status: RequisitionStatus.Issued,
      stock_entry: null,
      completed_at: null as Date | null,
      requested_date: '2026-03-23',
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          uom: 'Kg',
          requested_qty: 3,
          issued_qty: 5,
          received_qty: 0,
          item_status: 'Issued'
        }
      ]
    }

    requisitionsRepo.findOne.mockResolvedValue(requisition)

    const service = new RequisitionService(
      requisitionsRepo as any,
      requisitionItemsRepo as any,
      createRepositoryMock() as any,
      warehouseCacheRepo as any,
      queueService as any,
      notificationsService as any,
      erpService as any
    )

    await expect(
      service.confirm(6, {
        items: [{ item_code: 'CHICKEN', received_qty: 4, action: 'partial' }]
      })
    ).rejects.toThrow('received_qty cannot exceed requested_qty for CHICKEN')
  })

  it('allows finalize to be called again after auto-complete without duplicate side effects', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const warehouseCacheRepo = createRepositoryMock()
    const queueService = {
      enqueueCreateStockEntry: jest.fn(),
      enqueueCreateStockReconciliation: jest.fn(),
      enqueueErpWrite: jest.fn()
    }
    const notificationsService = {
      notifyStatusChange: jest.fn()
    }
    const erpService = {
      createMaterialRequestDraft: jest.fn()
    }
    const completedAt = new Date('2026-03-23T10:00:00.000Z')
    const requisition = {
      id: 7,
      status: RequisitionStatus.Completed,
      stock_entry: 'STE-0012',
      completed_at: completedAt,
      requested_date: '2026-03-23',
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          uom: 'Kg',
          requested_qty: 3,
          issued_qty: 3,
          received_qty: 3,
          item_status: 'Issued'
        }
      ]
    }

    requisitionsRepo.findOne.mockResolvedValue(requisition)

    const service = new RequisitionService(
      requisitionsRepo as any,
      requisitionItemsRepo as any,
      createRepositoryMock() as any,
      warehouseCacheRepo as any,
      queueService as any,
      notificationsService as any,
      erpService as any
    )

    const result = await service.finalize(7)

    expect(result).toEqual({ ok: true, status: RequisitionStatus.Completed })
    expect(requisition.completed_at).toBe(completedAt)
    expect(requisitionsRepo.save).not.toHaveBeenCalled()
    expect(queueService.enqueueErpWrite).not.toHaveBeenCalled()
    expect(queueService.enqueueCreateStockEntry).not.toHaveBeenCalled()
    expect(notificationsService.notifyStatusChange).not.toHaveBeenCalled()
  })

  it('blocks invalid finalize transitions before completion', async () => {
    const requisitionsRepo = createRepositoryMock()
    const requisitionItemsRepo = createRepositoryMock()
    const warehouseCacheRepo = createRepositoryMock()
    const queueService = {
      enqueueCreateStockEntry: jest.fn(),
      enqueueCreateStockReconciliation: jest.fn(),
      enqueueErpWrite: jest.fn()
    }
    const notificationsService = {
      notifyStatusChange: jest.fn()
    }
    const erpService = {
      createMaterialRequestDraft: jest.fn()
    }
    const requisition = {
      id: 8,
      status: RequisitionStatus.Submitted,
      stock_entry: null,
      completed_at: null as Date | null,
      requested_date: '2026-03-23',
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          uom: 'Kg',
          requested_qty: 3,
          issued_qty: 0,
          received_qty: 0,
          item_status: 'Pending'
        }
      ]
    }

    requisitionsRepo.findOne.mockResolvedValue(requisition)

    const service = new RequisitionService(
      requisitionsRepo as any,
      requisitionItemsRepo as any,
      createRepositoryMock() as any,
      warehouseCacheRepo as any,
      queueService as any,
      notificationsService as any,
      erpService as any
    )

    await expect(service.finalize(8)).rejects.toThrow(
      'Requisition is not ready to finalize'
    )
  })
})
