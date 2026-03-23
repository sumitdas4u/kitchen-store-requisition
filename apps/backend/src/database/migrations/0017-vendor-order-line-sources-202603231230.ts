import { MigrationInterface, QueryRunner } from 'typeorm'

export class VendorOrderLineSources20260323123000 implements MigrationInterface {
  name = 'VendorOrderLineSources20260323123000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vendor_order_line_sources (
        id SERIAL PRIMARY KEY,
        vendor_order_line_id INTEGER NOT NULL REFERENCES vendor_order_lines(id) ON DELETE CASCADE,
        requisition_id INTEGER NOT NULL,
        warehouse VARCHAR(200) NOT NULL,
        requested_date DATE NOT NULL,
        remaining_qty DECIMAL(18,3) NOT NULL DEFAULT 0
      );
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_order_line_sources_line_id
        ON vendor_order_line_sources(vendor_order_line_id);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_vendor_order_line_sources_line_id;`)
    await queryRunner.query(`DROP TABLE IF EXISTS vendor_order_line_sources;`)
  }
}
