export interface ErpItem {
  name: string
  item_name: string
  item_group: string
  stock_uom: string
}

export interface BinStock {
  item_code: string
  actual_qty: number
  stock_uom: string
  valuation_rate?: number
}

export interface ErpWarehouse {
  name: string
  warehouse_name?: string
  parent_warehouse?: string
  is_group?: number
  company?: string
}

export interface ErpCompany {
  name: string
  company_name?: string
  country?: string
}

export interface ErpItemGroup {
  name: string
  parent_item_group?: string
  disabled?: number | boolean | string
  is_group?: number | boolean | string
}

export interface ErpSupplier {
  name: string
  supplier_name?: string
  mobile_no?: string
  phone?: string
  disabled?: number | boolean | string
}

export interface ErpItemSupplier {
  parent: string
  supplier: string
  price_list_rate?: number
}

export interface ErpItemDefault {
  parent: string
  default_supplier?: string
  default_company?: string
  default_warehouse?: string
}

export interface ErpItemStatus {
  name: string
  disabled?: number | boolean | string
}

export interface ErpPurchaseReceiptSummary {
  name: string
  supplier?: string
  posting_date?: string
}

export interface ErpPurchaseReceiptItem {
  item_code: string
}

export interface ErpItemPrice {
  name: string
  item_code: string
  price_list: string
  price_list_rate: number
  uom?: string
  currency?: string
  valid_from?: string
}

export interface ErpPriceList {
  name: string
}

export interface ErpPurchaseReceipt {
  name: string
  supplier?: string
  posting_date?: string
  items?: ErpPurchaseReceiptItem[]
}

export interface ErpStockEntrySummary {
  name: string
  posting_date: string
  from_warehouse: string
  stock_entry_type: string
}

export interface ErpStockEntryDetail {
  parent: string
  item_code: string
  item_name: string | null
  uom: string | null
  qty: number
  s_warehouse: string | null
}
