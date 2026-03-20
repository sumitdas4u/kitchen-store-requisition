import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'erp_companies_cache' })
export class ErpCompanyCache {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  name: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  company_name: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  synced_at: Date
}
