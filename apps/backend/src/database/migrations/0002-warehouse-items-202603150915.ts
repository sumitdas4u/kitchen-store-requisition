import { MigrationInterface, QueryRunner } from 'typeorm'

export class WarehouseItems2026031509151690 implements MigrationInterface {
  name = 'WarehouseItems2026031509151690'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS warehouse_items (
        id SERIAL PRIMARY KEY,
        warehouse VARCHAR(200) NOT NULL,
        item_code VARCHAR(200) NOT NULL,
        company VARCHAR(200) NOT NULL,
        UNIQUE(warehouse, item_code)
      );
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS warehouse_items')
  }
}
