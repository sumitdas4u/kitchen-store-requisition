import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm'
import { RequisitionStatus, Shift, StockEntrySyncStatus } from '../../common/enums'
import { User } from './user.entity'
import { RequisitionItem } from './requisition-item.entity'

@Entity({ name: 'requisitions' })
export class Requisition {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 100, nullable: true })
  erp_name: string | null

  @Column({ type: 'integer', nullable: true })
  user_id: number | null

  @ManyToOne(() => User, (user) => user.requisitions, {
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({ type: 'varchar', length: 200 })
  warehouse: string

  @Column({ type: 'varchar', length: 200 })
  source_warehouse: string

  @Column({ type: 'varchar', length: 200 })
  company: string

  @Column({ type: 'date' })
  requested_date: string

  @Column({ type: 'varchar', length: 20 })
  shift: Shift

  @Column({ type: 'varchar', length: 50, default: RequisitionStatus.Draft })
  status: RequisitionStatus

  @Column({ type: 'varchar', length: 100, nullable: true })
  stock_entry: string | null

  @Column({
    type: 'varchar',
    length: 30,
    default: StockEntrySyncStatus.NotStarted
  })
  stock_entry_status: StockEntrySyncStatus

  @Column({ type: 'text', nullable: true })
  stock_entry_error_message: string | null

  @Column({ type: 'timestamp', nullable: true })
  stock_entry_last_attempt_at: Date | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  queue_job_id: string | null

  @Column({ type: 'boolean', default: false })
  erp_synced: boolean

  @Column({ type: 'timestamp', nullable: true })
  last_synced_at: Date | null

  @Column({ type: 'text', nullable: true })
  notes: string | null

  @Column({ type: 'text', nullable: true })
  store_note: string | null

  @Column({ type: 'timestamp', nullable: true })
  submitted_at: Date | null

  @Column({ type: 'timestamp', nullable: true })
  issued_at: Date | null

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date

  @OneToMany(() => RequisitionItem, (item) => item.requisition, {
    cascade: true
  })
  items: RequisitionItem[]
}
