import { MigrationInterface, QueryRunner } from 'typeorm'

export class CatalogCache20260317170000 implements MigrationInterface {
  name = 'CatalogCache20260317170000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS supplier_list_cache (
        name          VARCHAR(200) PRIMARY KEY,
        supplier_name VARCHAR(200),
        mobile_no     VARCHAR(50),
        disabled      BOOLEAN NOT NULL DEFAULT false,
        cached_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS item_catalog_cache (
        item_code    VARCHAR(200) PRIMARY KEY,
        item_name    VARCHAR(300),
        uom          VARCHAR(50),
        vendor_id    VARCHAR(200),
        vendor_name  VARCHAR(200),
        all_vendors  JSONB NOT NULL DEFAULT '[]',
        last_rate    DECIMAL(18,3) NOT NULL DEFAULT 0,
        last_po_date VARCHAR(20) NOT NULL DEFAULT '',
        cached_at    TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_item_catalog_vendor
        ON item_catalog_cache(vendor_id);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS item_catalog_cache;`)
    await queryRunner.query(`DROP TABLE IF EXISTS supplier_list_cache;`)
  }
}
