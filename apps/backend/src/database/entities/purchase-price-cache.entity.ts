import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'purchase_price_cache' })
@Index(['item_code', 'posting_date'])
export class PurchasePriceCache {
  @PrimaryGeneratedColumn()
  id: number

  /** ERP Purchase Receipt name */
  @Column({ type: 'varchar', length: 200 })
  receipt_name: string

  @Column({ type: 'date' })
  posting_date: string

  @Column({ type: 'varchar', length: 200 })
  item_code: string

  @Column({ type: 'varchar', length: 300, nullable: true })
  item_name: string | null

  @Column({ type: 'varchar', length: 200 })
  vendor_id: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  vendor_name: string | null

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  rate: number

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  qty: number

  @Column({ type: 'varchar', length: 50, nullable: true })
  uom: string | null

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  synced_at: Date
}
