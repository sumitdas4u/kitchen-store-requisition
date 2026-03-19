import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'app_settings' })
export class AppSettings {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 200, nullable: true })
  company: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  erp_base_url: string | null

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date
}
