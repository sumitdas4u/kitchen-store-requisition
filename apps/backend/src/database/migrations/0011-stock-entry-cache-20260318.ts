import { MigrationInterface, QueryRunner } from 'typeorm'

export class StockEntryCache20260318100000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stock_entry_line_cache (
        id           SERIAL PRIMARY KEY,
        entry_name   VARCHAR(200)   NOT NULL,
        posting_date DATE           NOT NULL,
        warehouse    VARCHAR(200)   NOT NULL,
        item_code    VARCHAR(200)   NOT NULL,
        item_name    VARCHAR(300),
        uom          VARCHAR(50),
        qty          DECIMAL(18,3)  NOT NULL DEFAULT 0,
        synced_at    TIMESTAMP      NOT NULL DEFAULT NOW()
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_selc_warehouse_date
        ON stock_entry_line_cache (warehouse, posting_date)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_selc_entry_name
        ON stock_entry_line_cache (entry_name)
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS stock_entry_line_cache`)
  }
}
