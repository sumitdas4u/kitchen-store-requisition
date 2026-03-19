import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Requisition } from './requisition.entity'

@Entity({ name: 'requisition_items' })
export class RequisitionItem {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'integer' })
  requisition_id: number

  @ManyToOne(() => Requisition, (requisition) => requisition.items, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'requisition_id' })
  requisition: Requisition

  @Column({ type: 'varchar', length: 200 })
  item_code: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  item_name: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  uom: string | null

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  closing_stock: number

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  required_qty: number

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  requested_qty: number

  @Column({ type: 'decimal', precision: 18, scale: 3, nullable: true })
  actual_closing: number | null

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  issued_qty: number

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  received_qty: number

  @Column({ type: 'varchar', length: 50, default: 'Pending' })
  item_status: string
}
