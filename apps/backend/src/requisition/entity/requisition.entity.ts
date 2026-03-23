import { RequisitionStatus, Shift, StockEntrySyncStatus } from '../../common/enums'

export class RequisitionEntity {
  id: number
  user_id: number
  warehouse: string
  source_warehouse: string
  company: string
  requested_date: string
  shift: Shift
  status: RequisitionStatus
  stock_entry?: string
  stock_entry_status?: StockEntrySyncStatus
  stock_entry_error_message?: string | null
  stock_entry_last_attempt_at?: string | null
  submitted_at?: string
  issued_at?: string
  completed_at?: string
  items: RequisitionItemEntity[]
}

export class RequisitionItemEntity {
  item_code: string
  item_name?: string
  uom?: string
  closing_stock: number
  required_qty: number
  requested_qty: number
  issued_qty: number
  received_qty: number
  item_status: string
}
