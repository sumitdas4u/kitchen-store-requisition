import { StoreService } from './store.service'

function createRepositoryMock() {
  return {
    count: jest.fn(),
    create: jest.fn((input) => ({ ...input })),
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    save: jest.fn(async (input) => input)
  }
}

describe('StoreService', () => {
  let service: StoreService
  let erpService: Record<string, jest.Mock>
  let requisitionService: Record<string, jest.Mock>
  let supplierCacheRepo: ReturnType<typeof createRepositoryMock>
  let catalogRepo: ReturnType<typeof createRepositoryMock>
  let vendorOverrideRepo: ReturnType<typeof createRepositoryMock>
  let vendorOrderRepo: ReturnType<typeof createRepositoryMock>
  let vendorOrderLineRepo: ReturnType<typeof createRepositoryMock>
  let vendorOrderLineSourceRepo: ReturnType<typeof createRepositoryMock>
  let vendorOrderPoRepo: ReturnType<typeof createRepositoryMock>
  let vendorReceiptRepo: ReturnType<typeof createRepositoryMock>
  let vendorReceiptLineRepo: ReturnType<typeof createRepositoryMock>
  let binStockCacheRepo: ReturnType<typeof createRepositoryMock>
  let warehouseCacheRepo: ReturnType<typeof createRepositoryMock>

  beforeEach(() => {
    erpService = {
      createPurchaseOrder: jest.fn(),
      getBinStock: jest.fn(),
      getPurchaseOrder: jest.fn(),
      getItemDefaults: jest.fn(),
      getItemSuppliers: jest.fn(),
      listOpenPurchaseOrders: jest.fn(),
      listPurchaseReceipts: jest.fn(),
      listSuppliers: jest.fn(),
      searchItems: jest.fn(),
      submitPurchaseOrder: jest.fn()
    }
    requisitionService = {
      getOne: jest.fn(),
      listForStore: jest.fn()
    }
    supplierCacheRepo = createRepositoryMock()
    catalogRepo = createRepositoryMock()
    vendorOverrideRepo = createRepositoryMock()
    vendorOrderRepo = createRepositoryMock()
    vendorOrderLineRepo = createRepositoryMock()
    vendorOrderLineSourceRepo = createRepositoryMock()
    vendorOrderPoRepo = createRepositoryMock()
    vendorReceiptRepo = createRepositoryMock()
    vendorReceiptLineRepo = createRepositoryMock()
    binStockCacheRepo = createRepositoryMock()
    warehouseCacheRepo = createRepositoryMock()

    service = new StoreService(
      erpService as any,
      requisitionService as any,
      supplierCacheRepo as any,
      catalogRepo as any,
      vendorOverrideRepo as any,
      vendorOrderRepo as any,
      vendorOrderLineRepo as any,
      vendorOrderLineSourceRepo as any,
      vendorOrderPoRepo as any,
      vendorReceiptRepo as any,
      vendorReceiptLineRepo as any,
      binStockCacheRepo as any,
      warehouseCacheRepo as any
    )
  })

  it('aggregates kitchen requests into one vendor-order shortage item with request sources', async () => {
    requisitionService.listForStore.mockResolvedValue([
      {
        id: 101,
        warehouse: 'Chinese Kitchen',
        requested_date: '2026-03-23',
        items: [
          {
            item_code: 'CHICKEN',
            item_name: 'Chicken',
            uom: 'Kg',
            requested_qty: 1,
            issued_qty: 0
          }
        ]
      },
      {
        id: 102,
        warehouse: 'Indian Kitchen',
        requested_date: '2026-03-23',
        items: [
          {
            item_code: 'CHICKEN',
            item_name: 'Chicken',
            uom: 'Kg',
            requested_qty: 2,
            issued_qty: 0
          }
        ]
      }
    ])
    binStockCacheRepo.find.mockResolvedValue([
      { item_code: 'CHICKEN', actual_qty: 1, valuation_rate: 240 }
    ])
    catalogRepo.find.mockResolvedValue([
      {
        item_code: 'CHICKEN',
        item_name: 'Chicken',
        uom: 'Kg',
        vendor_id: 'SUP-1',
        vendor_name: 'Fresh Farm',
        all_vendors: [{ vendorId: 'SUP-1', rate: 240, label: 'Fresh Farm' }],
        last_rate: 240,
        last_po_date: '03/20'
      }
    ])
    vendorOverrideRepo.find.mockResolvedValue([])

    const result = await service.getShortageItems('Stores - MAIN')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      item_code: 'CHICKEN',
      total_requested_qty: 3,
      default_order_qty: 3,
      needed_qty: 3,
      stock_qty: 1,
      shortfall_qty: 2,
      shortfall: 2,
      vendor_id: 'SUP-1'
    })
    expect(result[0].request_sources).toEqual([
      {
        requisition_id: 101,
        warehouse: 'Chinese Kitchen',
        requested_date: '2026-03-23',
        remaining_qty: 1
      },
      {
        requisition_id: 102,
        warehouse: 'Indian Kitchen',
        requested_date: '2026-03-23',
        remaining_qty: 2
      }
    ])
  })

  it('uses only the unissued balance when aggregating vendor-order demand', async () => {
    requisitionService.listForStore.mockResolvedValue([
      {
        id: 103,
        warehouse: 'Chinese Kitchen',
        requested_date: '2026-03-23',
        items: [
          {
            item_code: 'CHICKEN',
            item_name: 'Chicken',
            uom: 'Kg',
            requested_qty: 5,
            issued_qty: 3
          }
        ]
      }
    ])
    binStockCacheRepo.find.mockResolvedValue([])
    erpService.getBinStock.mockResolvedValue([])
    catalogRepo.find.mockResolvedValue([
      {
        item_code: 'CHICKEN',
        item_name: 'Chicken',
        uom: 'Kg',
        vendor_id: 'SUP-1',
        vendor_name: 'Fresh Farm',
        all_vendors: [{ vendorId: 'SUP-1', rate: 240, label: 'Fresh Farm' }],
        last_rate: 240,
        last_po_date: '03/20'
      }
    ])
    vendorOverrideRepo.find.mockResolvedValue([])

    const result = await service.getShortageItems('Stores - MAIN')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      item_code: 'CHICKEN',
      total_requested_qty: 2,
      default_order_qty: 2,
      needed_qty: 2,
      stock_qty: 0,
      shortfall_qty: 2,
      shortfall: 2
    })
    expect(result[0].request_sources).toEqual([
      {
        requisition_id: 103,
        warehouse: 'Chinese Kitchen',
        requested_date: '2026-03-23',
        remaining_qty: 2
      }
    ])
  })

  it('saves request source snapshots and uses the edited order qty when creating ERP purchase orders', async () => {
    warehouseCacheRepo.find.mockResolvedValue([{ name: 'Stores - MAIN', company: 'Food Studio' }])
    supplierCacheRepo.find.mockResolvedValue([{ name: 'SUP-1', supplier_name: 'Fresh Farm' }])
    erpService.createPurchaseOrder.mockResolvedValue('PO-0001')
    erpService.submitPurchaseOrder.mockResolvedValue(undefined)

    vendorOrderRepo.create.mockImplementation((input) => ({ ...input }))
    vendorOrderRepo.save.mockImplementation(async (input) => {
      if (input?.id) return input
      return { ...input, id: 10 }
    })
    vendorOrderLineRepo.create.mockImplementation((input) => ({ ...input }))
    vendorOrderLineRepo.save.mockImplementation(async (input) => {
      if (Array.isArray(input)) {
        input.forEach((line, index) => {
          line.id = index + 1
        })
      }
      return input
    })
    vendorOrderLineSourceRepo.create.mockImplementation((input) => ({ ...input }))
    vendorOrderPoRepo.create.mockImplementation((input) => ({ ...input }))

    const result = await service.createVendorOrders(
      {
        user_id: 7,
        company: 'Food Studio',
        source_warehouse: 'Stores - MAIN'
      },
      {
        lines: [
          {
            item_code: 'CHICKEN',
            item_name: 'Chicken',
            uom: 'Kg',
            qty: 2.5,
            price: 240,
            vendor_id: 'SUP-1',
            is_manual: false,
            request_sources: [
              {
                requisition_id: 101,
                warehouse: 'Chinese Kitchen',
                requested_date: '2026-03-23',
                remaining_qty: 1
              },
              {
                requisition_id: 102,
                warehouse: 'Indian Kitchen',
                requested_date: '2026-03-23',
                remaining_qty: 2
              }
            ]
          }
        ]
      }
    )

    expect(erpService.createPurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        supplier: 'SUP-1',
        items: [
          expect.objectContaining({
            item_code: 'CHICKEN',
            qty: 2.5,
            rate: 240
          })
        ]
      })
    )
    expect(vendorOrderLineSourceRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          vendor_order_line_id: 1,
          requisition_id: 101,
          warehouse: 'Chinese Kitchen',
          remaining_qty: 1
        }),
        expect.objectContaining({
          vendor_order_line_id: 1,
          requisition_id: 102,
          warehouse: 'Indian Kitchen',
          remaining_qty: 2
        })
      ])
    )
    expect(result).toEqual({
      vendor_order_id: 10,
      purchase_orders: [{ vendor_id: 'SUP-1', po_id: 'PO-0001' }],
      failed: []
    })
  })

  it('does not save request source rows for manual-only vendor order lines', async () => {
    warehouseCacheRepo.find.mockResolvedValue([{ name: 'Stores - MAIN', company: 'Food Studio' }])
    supplierCacheRepo.find.mockResolvedValue([{ name: 'SUP-2', supplier_name: 'Local Vendor' }])
    erpService.createPurchaseOrder.mockResolvedValue('PO-0002')
    erpService.submitPurchaseOrder.mockResolvedValue(undefined)

    vendorOrderRepo.create.mockImplementation((input) => ({ ...input }))
    vendorOrderRepo.save.mockImplementation(async (input) => {
      if (input?.id) return input
      return { ...input, id: 11 }
    })
    vendorOrderLineRepo.create.mockImplementation((input) => ({ ...input }))
    vendorOrderLineRepo.save.mockImplementation(async (input) => {
      if (Array.isArray(input)) {
        input.forEach((line, index) => {
          line.id = index + 1
        })
      }
      return input
    })
    vendorOrderPoRepo.create.mockImplementation((input) => ({ ...input }))

    await service.createVendorOrders(
      {
        user_id: 7,
        company: 'Food Studio',
        source_warehouse: 'Stores - MAIN'
      },
      {
        lines: [
          {
            item_code: 'OIL',
            item_name: 'Cooking Oil',
            uom: 'Ltr',
            qty: 1,
            price: 120,
            vendor_id: 'SUP-2',
            is_manual: true,
            request_sources: []
          }
        ]
      }
    )

    expect(vendorOrderLineSourceRepo.save).not.toHaveBeenCalled()
  })

  it('returns saved request snapshots in vendor order history for successful and failed purchase orders', async () => {
    vendorOrderPoRepo.find.mockResolvedValue([
      {
        id: 1,
        po_id: 'PO-0001',
        vendor_order_id: 10,
        vendor_id: 'SUP-1',
        vendor_name: 'Fresh Farm',
        status: 'po_created',
        error_message: null,
        created_at: new Date('2026-03-23T10:00:00Z')
      },
      {
        id: 2,
        po_id: 'FAIL-123',
        vendor_order_id: 11,
        vendor_id: 'SUP-2',
        vendor_name: 'Local Vendor',
        status: 'failed',
        error_message: 'ERP down',
        created_at: new Date('2026-03-22T10:00:00Z')
      }
    ])
    vendorOrderLineRepo.find.mockResolvedValue([
      {
        vendor_order_id: 10,
        vendor_id: 'SUP-1',
        item_code: 'CHICKEN',
        item_name: 'Chicken',
        uom: 'Kg',
        qty: 2.5,
        price: 240,
        request_sources: [
          {
            requisition_id: 101,
            warehouse: 'Chinese Kitchen',
            requested_date: '2026-03-23',
            remaining_qty: 1
          },
          {
            requisition_id: 102,
            warehouse: 'Indian Kitchen',
            requested_date: '2026-03-23',
            remaining_qty: 2
          }
        ]
      },
      {
        vendor_order_id: 11,
        vendor_id: 'SUP-2',
        item_code: 'RICE',
        item_name: 'Rice',
        uom: 'Kg',
        qty: 4,
        price: 60,
        request_sources: [
          {
            requisition_id: 201,
            warehouse: 'House Keeping',
            requested_date: '2026-03-22',
            remaining_qty: 4
          }
        ]
      }
    ])
    erpService.getPurchaseOrder.mockResolvedValue({
      status: 'To Receive',
      grand_total: 600,
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          qty: 2.5,
          uom: 'Kg',
          rate: 240
        }
      ]
    })

    const history = await service.listVendorOrderHistory()

    const success = history.find((row) => row.po_id === 'PO-0001')
    const failed = history.find((row) => row.po_id === 'FAIL-123')

    expect(success?.erp_items[0]).toMatchObject({
      item_code: 'CHICKEN',
      requested_total_qty: 3
    })
    expect(success?.erp_items[0].request_sources).toEqual([
      {
        requisition_id: 101,
        warehouse: 'Chinese Kitchen',
        requested_date: '2026-03-23',
        remaining_qty: 1
      },
      {
        requisition_id: 102,
        warehouse: 'Indian Kitchen',
        requested_date: '2026-03-23',
        remaining_qty: 2
      }
    ])
    expect(failed?.erp_items[0]).toMatchObject({
      item_code: 'RICE',
      requested_total_qty: 4
    })
    expect(failed?.erp_items[0].request_sources).toEqual([
      {
        requisition_id: 201,
        warehouse: 'House Keeping',
        requested_date: '2026-03-22',
        remaining_qty: 4
      }
    ])
  })

  it('retries a failed PO and updates the existing record when ERP creation succeeds', async () => {
    const failedRecord = {
      id: 22,
      vendor_order_id: 10,
      vendor_id: 'SUP-1',
      vendor_name: 'Fresh Farm',
      po_id: 'FAIL-999',
      status: 'failed',
      error_message: 'Temporary ERP error'
    }

    vendorOrderPoRepo.findOne.mockResolvedValue(failedRecord)
    vendorOrderLineRepo.find.mockResolvedValue([
      {
        item_code: 'CHICKEN',
        item_name: 'Chicken',
        uom: 'Kg',
        qty: 2.5,
        price: 240,
        vendor_id: 'SUP-1'
      }
    ])
    warehouseCacheRepo.find.mockResolvedValue([{ name: 'Stores - MAIN', company: 'Food Studio' }])
    erpService.createPurchaseOrder.mockResolvedValue('PO-RETRY-1')
    erpService.submitPurchaseOrder.mockResolvedValue(undefined)
    vendorOrderPoRepo.save.mockImplementation(async (input) => input)

    const result = await service.retryFailedPo(22, {
      user_id: 7,
      company: 'Food Studio',
      source_warehouse: 'Stores - MAIN'
    })

    expect(erpService.createPurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        supplier: 'SUP-1',
        company: 'Food Studio',
        set_warehouse: 'Stores - MAIN',
        items: [
          expect.objectContaining({
            item_code: 'CHICKEN',
            qty: 2.5,
            rate: 240
          })
        ]
      })
    )
    expect(erpService.submitPurchaseOrder).toHaveBeenCalledWith('PO-RETRY-1')
    expect(vendorOrderPoRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 22,
        po_id: 'PO-RETRY-1',
        status: 'po_created',
        error_message: null
      })
    )
    expect(result).toEqual({
      success: true,
      po_id: 'PO-RETRY-1',
      vendor_id: 'SUP-1'
    })
  })

  it('keeps the PO failed and stores the latest error when retry fails again', async () => {
    const failedRecord = {
      id: 23,
      vendor_order_id: 11,
      vendor_id: 'SUP-2',
      vendor_name: 'Local Vendor',
      po_id: 'FAIL-123',
      status: 'failed',
      error_message: 'Previous failure'
    }

    vendorOrderPoRepo.findOne.mockResolvedValue(failedRecord)
    vendorOrderLineRepo.find.mockResolvedValue([
      {
        item_code: 'RICE',
        item_name: 'Rice',
        uom: 'Kg',
        qty: 4,
        price: 60,
        vendor_id: 'SUP-2'
      }
    ])
    warehouseCacheRepo.find.mockResolvedValue([{ name: 'Stores - MAIN', company: 'Food Studio' }])
    erpService.createPurchaseOrder.mockRejectedValue({
      response: {
        data: {
          message: 'ERP unavailable'
        }
      }
    })
    vendorOrderPoRepo.save.mockImplementation(async (input) => input)

    const result = await service.retryFailedPo(23, {
      user_id: 7,
      company: 'Food Studio',
      source_warehouse: 'Stores - MAIN'
    })

    expect(erpService.submitPurchaseOrder).not.toHaveBeenCalled()
    expect(vendorOrderPoRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 23,
        po_id: 'FAIL-123',
        status: 'failed',
        error_message: 'ERP unavailable'
      })
    )
    expect(result).toEqual({
      success: false,
      error: 'ERP unavailable',
      vendor_id: 'SUP-2'
    })
  })
})
