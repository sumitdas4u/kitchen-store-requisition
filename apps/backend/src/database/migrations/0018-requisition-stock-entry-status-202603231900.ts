import { MigrationInterface, QueryRunner } from 'typeorm'

export class RequisitionStockEntryStatus20260323190000
  implements MigrationInterface
{
  name = 'RequisitionStockEntryStatus20260323190000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE requisitions
        ADD COLUMN IF NOT EXISTS stock_entry_status VARCHAR(30) NOT NULL DEFAULT 'not_started';
    `)

    await queryRunner.query(`
      ALTER TABLE requisitions
        ADD COLUMN IF NOT EXISTS stock_entry_error_message TEXT;
    `)

    await queryRunner.query(`
      ALTER TABLE requisitions
        ADD COLUMN IF NOT EXISTS stock_entry_last_attempt_at TIMESTAMP;
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_requisitions_stock_entry_status
        ON requisitions(stock_entry_status);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_requisitions_stock_entry_status`)
    await queryRunner.query(`
      ALTER TABLE requisitions
        DROP COLUMN IF EXISTS stock_entry_last_attempt_at
    `)
    await queryRunner.query(`
      ALTER TABLE requisitions
        DROP COLUMN IF EXISTS stock_entry_error_message
    `)
    await queryRunner.query(`
      ALTER TABLE requisitions
        DROP COLUMN IF EXISTS stock_entry_status
    `)
  }
}
