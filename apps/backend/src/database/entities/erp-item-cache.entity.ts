import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'erp_items_cache' })
export class ErpItemCache {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  item_code: string

  @Column({ type: 'varchar', length: 300, nullable: true })
  item_name: string | null

  @Column({ type: 'varchar', length: 200, nullable: true })
  item_group: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  stock_uom: string | null

  @Column({ type: 'boolean', default: false })
  disabled: boolean

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  synced_at: Date
}
