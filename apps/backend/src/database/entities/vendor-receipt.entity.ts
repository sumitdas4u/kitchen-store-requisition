import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn
} from 'typeorm'
import { VendorReceiptLine } from './vendor-receipt-line.entity'

@Entity({ name: 'vendor_receipts' })
export class VendorReceipt {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 200 })
  vendor_id: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  vendor_name: string | null

  @Column({ type: 'varchar', length: 200 })
  po_id: string

  @Column({ type: 'varchar', length: 200 })
  receipt_id: string

  @Column({ type: 'integer', nullable: true })
  created_by: number | null

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date

  @OneToMany(() => VendorReceiptLine, (line) => line.vendor_receipt, {
    cascade: true
  })
  lines: VendorReceiptLine[]
}
