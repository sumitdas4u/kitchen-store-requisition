import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm'
import { VendorOrder } from './vendor-order.entity'

@Entity({ name: 'vendor_order_pos' })
export class VendorOrderPo {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'integer' })
  vendor_order_id: number

  @ManyToOne(() => VendorOrder, (order) => order.purchase_orders, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'vendor_order_id' })
  vendor_order: VendorOrder

  @Column({ type: 'varchar', length: 200 })
  vendor_id: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  vendor_name: string | null

  @Column({ type: 'varchar', length: 200 })
  po_id: string

  @Column({ type: 'varchar', length: 50, default: 'po_created' })
  status: string

  @Column({ type: 'text', nullable: true })
  error_message: string | null

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date
}
