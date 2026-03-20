import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'erp_warehouses_cache' })
export class ErpWarehouseCache {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  name: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  warehouse_name: string | null

  @Column({ type: 'varchar', length: 200, nullable: true })
  parent_warehouse: string | null

  @Column({ type: 'boolean', default: false })
  is_group: boolean

  @Column({ type: 'varchar', length: 200, nullable: true })
  company: string | null

  @Column({ type: 'boolean', default: false })
  disabled: boolean

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  synced_at: Date
}
