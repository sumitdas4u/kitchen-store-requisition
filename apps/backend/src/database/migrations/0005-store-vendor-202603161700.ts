import { MigrationInterface, QueryRunner } from 'typeorm'

export class StoreVendor2026031617001690 implements MigrationInterface {
  name = 'StoreVendor2026031617001690'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendor_item_overrides (
        id SERIAL PRIMARY KEY,
        item_code VARCHAR(200) NOT NULL,
        vendor_id VARCHAR(200) NOT NULL,
        vendor_name VARCHAR(200),
        source VARCHAR(50) NOT NULL DEFAULT 'manual',
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendor_orders (
        id SERIAL PRIMARY KEY,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        created_by INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendor_order_lines (
        id SERIAL PRIMARY KEY,
        vendor_order_id INTEGER NOT NULL REFERENCES vendor_orders(id) ON DELETE CASCADE,
        item_code VARCHAR(200) NOT NULL,
        item_name VARCHAR(200),
        uom VARCHAR(50),
        qty DECIMAL(18,3) NOT NULL DEFAULT 0,
        price DECIMAL(18,3) NOT NULL DEFAULT 0,
        vendor_id VARCHAR(200) NOT NULL,
        is_manual BOOLEAN NOT NULL DEFAULT false
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendor_order_pos (
        id SERIAL PRIMARY KEY,
        vendor_order_id INTEGER NOT NULL REFERENCES vendor_orders(id) ON DELETE CASCADE,
        vendor_id VARCHAR(200) NOT NULL,
        vendor_name VARCHAR(200),
        po_id VARCHAR(200) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'po_created',
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendor_receipts (
        id SERIAL PRIMARY KEY,
        vendor_id VARCHAR(200) NOT NULL,
        vendor_name VARCHAR(200),
        po_id VARCHAR(200) NOT NULL,
        receipt_id VARCHAR(200) NOT NULL,
        created_by INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendor_receipt_lines (
        id SERIAL PRIMARY KEY,
        vendor_receipt_id INTEGER NOT NULL REFERENCES vendor_receipts(id) ON DELETE CASCADE,
        item_code VARCHAR(200) NOT NULL,
        item_name VARCHAR(200),
        uom VARCHAR(50),
        qty DECIMAL(18,3) NOT NULL DEFAULT 0
      );
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS vendor_receipt_lines;`)
    await queryRunner.query(`DROP TABLE IF EXISTS vendor_receipts;`)
    await queryRunner.query(`DROP TABLE IF EXISTS vendor_order_pos;`)
    await queryRunner.query(`DROP TABLE IF EXISTS vendor_order_lines;`)
    await queryRunner.query(`DROP TABLE IF EXISTS vendor_orders;`)
    await queryRunner.query(`DROP TABLE IF EXISTS vendor_item_overrides;`)
  }
}
