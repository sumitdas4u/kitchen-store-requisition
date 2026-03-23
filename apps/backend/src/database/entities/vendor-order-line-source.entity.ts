import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm'
import { VendorOrderLine } from './vendor-order-line.entity'

@Entity({ name: 'vendor_order_line_sources' })
export class VendorOrderLineSource {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'integer' })
  vendor_order_line_id: number

  @ManyToOne(() => VendorOrderLine, (line) => line.request_sources, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'vendor_order_line_id' })
  vendor_order_line: VendorOrderLine

  @Column({ type: 'integer' })
  requisition_id: number

  @Column({ type: 'varchar', length: 200 })
  warehouse: string

  @Column({ type: 'date' })
  requested_date: string

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  remaining_qty: number
}
