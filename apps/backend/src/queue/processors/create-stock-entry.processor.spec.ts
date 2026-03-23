import { RequisitionStatus, StockEntrySyncStatus } from '../../common/enums'
import { CreateStockEntryProcessor } from './create-stock-entry.processor'

function createRepositoryMock() {
  return {
    findOne: jest.fn(),
    save: jest.fn()
  }
}

describe('CreateStockEntryProcessor', () => {
  it('creates and immediately submits the stock entry when the requisition is already completed', async () => {
    const requisitionsRepo = createRepositoryMock()
    const erpService = {
      createStockEntryDraft: jest.fn().mockResolvedValue('STE-0099'),
      submitStockEntry: jest.fn().mockResolvedValue(undefined)
    }

    const requisition = {
      id: 99,
      status: RequisitionStatus.Completed,
      company: 'Food Studio',
      warehouse: 'Chinese Kitchen',
      source_warehouse: 'Stores - MAIN',
      requested_date: '2026-03-23',
      stock_entry: null,
      stock_entry_status: StockEntrySyncStatus.DraftPending,
      items: [
        {
          item_code: 'CHICKEN',
          item_name: 'Chicken',
          uom: 'Kg',
          issued_qty: 3,
          received_qty: 2,
          erp_mr_item_name: 'MRI-0099'
        }
      ]
    }

    requisitionsRepo.findOne.mockResolvedValue(requisition)
    requisitionsRepo.save.mockImplementation(async (input) => input)

    const processor = new CreateStockEntryProcessor(
      erpService as any,
      requisitionsRepo as any
    )

    const result = await processor.process({
      data: { requisitionId: '99' }
    } as any)

    expect(result).toBe('STE-0099')
    expect(erpService.createStockEntryDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ item_code: 'CHICKEN', qty: 2 })]
      })
    )
    expect(erpService.submitStockEntry).toHaveBeenCalledWith('STE-0099')
    expect(requisition.stock_entry).toBe('STE-0099')
    expect(requisition.stock_entry_status).toBe(StockEntrySyncStatus.Submitted)
  })
})
