import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm'
import { Role } from '../../common/enums'
import { UserWarehouse } from './user-warehouse.entity'
import { Requisition } from './requisition.entity'

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 100, unique: true })
  username: string

  @Column({ type: 'varchar', length: 200 })
  full_name: string

  @Column({ type: 'varchar', length: 200, unique: true })
  email: string

  @Column({ type: 'varchar', length: 255 })
  password_hash: string

  @Column({ type: 'varchar', length: 50 })
  role: Role

  @Column({ type: 'varchar', length: 200 })
  company: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  default_warehouse: string | null

  @Column({ type: 'varchar', length: 200, nullable: true })
  source_warehouse: string | null

  @Column({ type: 'boolean', default: true })
  is_active: boolean

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date

  @OneToMany(() => UserWarehouse, (warehouse) => warehouse.user, {
    cascade: true
  })
  warehouses: UserWarehouse[]

  @OneToMany(() => Requisition, (requisition) => requisition.user)
  requisitions: Requisition[]
}
