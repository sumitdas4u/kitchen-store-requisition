import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn
} from 'typeorm'
import { VendorOrderLine } from './vendor-order-line.entity'
import { VendorOrderPo } from './vendor-order-po.entity'

@Entity({ name: 'vendor_orders' })
export class VendorOrder {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 50, default: 'draft' })
  status: string

  @Column({ type: 'integer', nullable: true })
  created_by: number | null

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date

  @OneToMany(() => VendorOrderLine, (line) => line.vendor_order, {
    cascade: true
  })
  lines: VendorOrderLine[]

  @OneToMany(() => VendorOrderPo, (po) => po.vendor_order, {
    cascade: true
  })
  purchase_orders: VendorOrderPo[]
}
