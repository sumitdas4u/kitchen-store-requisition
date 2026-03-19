export interface PurchaseReceiptLineDto {
  item_code: string
  qty: number
  item_name?: string
  uom?: string
}

export class CreatePurchaseReceiptDto {
  po_id: string
  vendor_id: string
  vendor_name?: string
  lines: PurchaseReceiptLineDto[]
}
