import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'supplier_list_cache' })
export class SupplierListCache {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  name: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  supplier_name: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  mobile_no: string | null

  @Column({ type: 'boolean', default: false })
  disabled: boolean

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  cached_at: Date
}
