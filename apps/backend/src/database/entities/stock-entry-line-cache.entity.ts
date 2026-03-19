import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'stock_entry_line_cache' })
@Index(['warehouse', 'posting_date'])
export class StockEntryLineCache {
  @PrimaryGeneratedColumn()
  id: number

  /** ERP Stock Entry name (e.g. STE-00123) */
  @Column({ type: 'varchar', length: 200 })
  entry_name: string

  /** Date the stock entry was posted in ERP */
  @Column({ type: 'date' })
  posting_date: string

  /** Source warehouse (items moved OUT of here) */
  @Column({ type: 'varchar', length: 200 })
  warehouse: string

  @Column({ type: 'varchar', length: 200 })
  item_code: string

  @Column({ type: 'varchar', length: 300, nullable: true })
  item_name: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  uom: string | null

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  qty: number

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  synced_at: Date
}
