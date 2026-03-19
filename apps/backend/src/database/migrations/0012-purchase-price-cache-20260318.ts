import { MigrationInterface, QueryRunner } from 'typeorm'

export class PurchasePriceCache20260318120000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS purchase_price_cache (
        id            SERIAL PRIMARY KEY,
        receipt_name  VARCHAR(200)   NOT NULL,
        posting_date  DATE           NOT NULL,
        item_code     VARCHAR(200)   NOT NULL,
        item_name     VARCHAR(300),
        vendor_id     VARCHAR(200)   NOT NULL,
        vendor_name   VARCHAR(200),
        rate          DECIMAL(18,3)  NOT NULL DEFAULT 0,
        qty           DECIMAL(18,3)  NOT NULL DEFAULT 0,
        uom           VARCHAR(50),
        synced_at     TIMESTAMP      NOT NULL DEFAULT NOW()
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ppc_item_date
        ON purchase_price_cache (item_code, posting_date)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ppc_vendor
        ON purchase_price_cache (vendor_id)
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_price_cache`)
  }
}
