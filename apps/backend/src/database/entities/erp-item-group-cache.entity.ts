import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'erp_item_groups_cache' })
export class ErpItemGroupCache {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  name: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  parent_item_group: string | null

  @Column({ type: 'boolean', default: false })
  is_group: boolean

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  synced_at: Date
}
