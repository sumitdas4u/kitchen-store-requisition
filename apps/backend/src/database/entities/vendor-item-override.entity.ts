import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm'

@Entity({ name: 'vendor_item_overrides' })
export class VendorItemOverride {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 200 })
  item_code: string

  @Column({ type: 'varchar', length: 200 })
  vendor_id: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  vendor_name: string | null

  @Column({ type: 'varchar', length: 50, default: 'manual' })
  source: string

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date
}
