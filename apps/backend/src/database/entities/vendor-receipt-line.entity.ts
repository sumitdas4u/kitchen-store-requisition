import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm'
import { VendorReceipt } from './vendor-receipt.entity'

@Entity({ name: 'vendor_receipt_lines' })
export class VendorReceiptLine {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'integer' })
  vendor_receipt_id: number

  @ManyToOne(() => VendorReceipt, (receipt) => receipt.lines, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'vendor_receipt_id' })
  vendor_receipt: VendorReceipt

  @Column({ type: 'varchar', length: 200 })
  item_code: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  item_name: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  uom: string | null

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  qty: number
}
