import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm'
import { User } from './user.entity'

@Entity({ name: 'user_warehouses' })
@Index(['user_id', 'warehouse'], { unique: true })
export class UserWarehouse {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'integer' })
  user_id: number

  @Column({ type: 'varchar', length: 200 })
  warehouse: string

  @ManyToOne(() => User, (user) => user.warehouses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User
}
