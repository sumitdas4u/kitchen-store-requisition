import { MigrationInterface, QueryRunner } from 'typeorm'

export class ErpCacheTables20260320 implements MigrationInterface {
  name = 'ErpCacheTables20260320'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_items_cache (
        item_code   VARCHAR(200) PRIMARY KEY,
        item_name   VARCHAR(300),
        item_group  VARCHAR(200),
        stock_uom   VARCHAR(50),
        disabled    BOOLEAN NOT NULL DEFAULT false,
        synced_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_erp_items_cache_group
        ON erp_items_cache(item_group);
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_item_groups_cache (
        name               VARCHAR(200) PRIMARY KEY,
        parent_item_group  VARCHAR(200),
        is_group           BOOLEAN NOT NULL DEFAULT false,
        synced_at          TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_warehouses_cache (
        name              VARCHAR(200) PRIMARY KEY,
        warehouse_name    VARCHAR(200),
        parent_warehouse  VARCHAR(200),
        is_group          BOOLEAN NOT NULL DEFAULT false,
        company           VARCHAR(200),
        disabled          BOOLEAN NOT NULL DEFAULT false,
        synced_at         TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_erp_warehouses_cache_company
        ON erp_warehouses_cache(company);
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_companies_cache (
        name          VARCHAR(200) PRIMARY KEY,
        company_name  VARCHAR(200),
        country       VARCHAR(100),
        synced_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_bin_stock_cache (
        warehouse       VARCHAR(200) NOT NULL,
        item_code       VARCHAR(200) NOT NULL,
        actual_qty      DECIMAL(18,3) NOT NULL DEFAULT 0,
        stock_uom       VARCHAR(50),
        valuation_rate  DECIMAL(18,3) NOT NULL DEFAULT 0,
        synced_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (warehouse, item_code)
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id             SERIAL PRIMARY KEY,
        entity         VARCHAR(50) NOT NULL,
        status         VARCHAR(20) NOT NULL DEFAULT 'running',
        record_count   INTEGER NOT NULL DEFAULT 0,
        duration_ms    INTEGER,
        error_message  TEXT,
        started_at     TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at   TIMESTAMP
      );
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_log_entity
        ON sync_log(entity, started_at DESC);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS sync_log;`)
    await queryRunner.query(`DROP TABLE IF EXISTS erp_bin_stock_cache;`)
    await queryRunner.query(`DROP TABLE IF EXISTS erp_companies_cache;`)
    await queryRunner.query(`DROP TABLE IF EXISTS erp_warehouses_cache;`)
    await queryRunner.query(`DROP TABLE IF EXISTS erp_item_groups_cache;`)
    await queryRunner.query(`DROP TABLE IF EXISTS erp_items_cache;`)
  }
}
