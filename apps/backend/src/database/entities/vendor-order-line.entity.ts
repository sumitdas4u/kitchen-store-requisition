import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn
} from 'typeorm'
import { VendorOrder } from './vendor-order.entity'
import { VendorOrderLineSource } from './vendor-order-line-source.entity'

@Entity({ name: 'vendor_order_lines' })
export class VendorOrderLine {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'integer' })
  vendor_order_id: number

  @ManyToOne(() => VendorOrder, (order) => order.lines, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'vendor_order_id' })
  vendor_order: VendorOrder

  @Column({ type: 'varchar', length: 200 })
  item_code: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  item_name: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  uom: string | null

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  qty: number

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  price: number

  @Column({ type: 'varchar', length: 200 })
  vendor_id: string

  @Column({ type: 'boolean', default: false })
  is_manual: boolean

  @OneToMany(() => VendorOrderLineSource, (source) => source.vendor_order_line, {
    cascade: true
  })
  request_sources: VendorOrderLineSource[]
}
