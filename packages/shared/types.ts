export type RequisitionStatus =
  | 'Draft'
  | 'Submitted'
  | 'Partially Issued'
  | 'Issued'
  | 'Disputed'
  | 'Completed'
  | 'Rejected'

export type Shift = 'Morning' | 'Evening'

export type Role = 'Kitchen User' | 'Store User' | 'Admin'

export interface AppUser {
  id: number
  username: string
  full_name: string
  email: string
  role: Role
  company: string
  default_warehouse: string | null
  source_warehouse: string | null
  warehouses: string[]
  is_active: boolean
}

export interface JwtPayload {
  sub: number
  username: string
  role: Role
  company: string
  default_warehouse: string | null
  source_warehouse: string | null
}

export interface RequisitionItem {
  id?: number
  item_code: string
  item_name: string
  uom: string
  closing_stock: number
  required_qty: number
  requested_qty: number
  issued_qty: number
  received_qty: number
  item_status: 'Pending' | 'Issued' | 'Partially Issued' | 'Rejected'
}

export interface Requisition {
  id: number
  erp_name?: string
  user_id: number
  warehouse: string
  source_warehouse: string
  company: string
  requested_date: string
  shift: Shift
  status: RequisitionStatus
  stock_entry?: string
  items: RequisitionItem[]
}

export interface BinStock {
  item_code: string
  actual_qty: number
  stock_uom: string
}

export interface ErpItem {
  name: string
  item_name: string
  item_group: string
  stock_uom: string
}
