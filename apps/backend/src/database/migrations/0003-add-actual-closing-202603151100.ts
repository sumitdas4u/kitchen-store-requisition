import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddActualClosing20260315110000 implements MigrationInterface {
  name = 'AddActualClosing20260315110000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS requisition_items
      ADD COLUMN IF NOT EXISTS actual_closing DECIMAL(18,3);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS requisition_items
      DROP COLUMN IF EXISTS actual_closing;
    `)
  }
}
