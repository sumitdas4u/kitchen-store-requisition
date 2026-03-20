import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'sync_log' })
export class SyncLog {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 50 })
  entity: string

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: string

  @Column({ type: 'int', default: 0 })
  record_count: number

  @Column({ type: 'int', nullable: true })
  duration_ms: number | null

  @Column({ type: 'text', nullable: true })
  error_message: string | null

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  started_at: Date

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null
}
