import { RequisitionStatus, Shift } from '../../common/enums'

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
}
