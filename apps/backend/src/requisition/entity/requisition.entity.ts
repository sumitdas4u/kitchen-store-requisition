import { RequisitionStatus, Shift } from '../../common/enums'

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
