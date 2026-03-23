import { RequisitionStatus, Shift, StockEntrySyncStatus } from '../../common/enums'

export interface Requisition {
  id: number
  warehouse: string
  requested_date: string
  shift: Shift
  status: RequisitionStatus
  user_id: number
  submitted_at?: string
  issued_at?: string
  completed_at?: string
  stock_entry?: string
  stock_entry_status?: StockEntrySyncStatus
  stock_entry_error_message?: string | null
  stock_entry_last_attempt_at?: string | null
}
