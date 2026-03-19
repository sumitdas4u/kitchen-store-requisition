import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'warehouse_items' })
@Index(['warehouse', 'item_code'], { unique: true })
export class WarehouseItem {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 200 })
  warehouse: string

  @Column({ type: 'varchar', length: 200 })
  item_code: string

  @Column({ type: 'varchar', length: 200 })
  company: string
}
