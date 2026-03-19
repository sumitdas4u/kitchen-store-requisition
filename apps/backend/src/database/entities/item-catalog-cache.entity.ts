import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'item_catalog_cache' })
export class ItemCatalogCache {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  item_code: string

  @Column({ type: 'varchar', length: 300, nullable: true })
  item_name: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  uom: string | null

  /** Preferred vendor id */
  @Column({ type: 'varchar', length: 200, nullable: true })
  vendor_id: string | null

  @Column({ type: 'varchar', length: 200, nullable: true })
  vendor_name: string | null

  /** JSON array: [{vendorId, rate, label}] */
  @Column({ type: 'jsonb', default: '[]' })
  all_vendors: Array<{ vendorId: string; rate: number; label: string }>

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 })
  last_rate: number

  @Column({ type: 'varchar', length: 20, default: '' })
  last_po_date: string

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  cached_at: Date
}
