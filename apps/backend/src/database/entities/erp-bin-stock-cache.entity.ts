import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'erp_bin_stock_cache' })
export class ErpBinStockCache {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  warehouse: string

  @PrimaryColumn({ type: 'varchar', length: 200 })
  item_code: string

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  actual_qty: number

  @Column({ type: 'varchar', length: 50, nullable: true })
  stock_uom: string | null

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  valuation_rate: number

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  synced_at: Date
}
