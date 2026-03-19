import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'warehouse_item_groups' })
@Index(['warehouse', 'item_group'], { unique: true })
export class WarehouseItemGroup {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 200 })
  warehouse: string

  @Column({ type: 'varchar', length: 200 })
  item_group: string

  @Column({ type: 'varchar', length: 200 })
  company: string
}
