import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'price_change_log' })
export class PriceChangeLog {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 200 })
  item_code: string

  @Column({ type: 'varchar', length: 300, nullable: true })
  item_name: string | null

  @Column({ type: 'varchar', length: 200 })
  price_list: string

  @Column({ type: 'decimal', precision: 18, scale: 3, nullable: true })
  old_price: number | null

  @Column({ type: 'decimal', precision: 18, scale: 3 })
  new_price: number

  @Column({ type: 'integer', nullable: true })
  changed_by_id: number | null

  @Column({ type: 'varchar', length: 200, nullable: true })
  changed_by_name: string | null

  @CreateDateColumn({ type: 'timestamp' })
  changed_at: Date
}
