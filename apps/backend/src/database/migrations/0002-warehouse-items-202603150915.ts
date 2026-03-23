import { MigrationInterface, QueryRunner } from 'typeorm'

export class WarehouseItems20260315091500 implements MigrationInterface {
  name = 'WarehouseItems20260315091500'

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
