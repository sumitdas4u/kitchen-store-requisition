import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddActualClosing2026031511001690 implements MigrationInterface {
  name = 'AddActualClosing2026031511001690'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE requisition_items
      ADD COLUMN IF NOT EXISTS actual_closing DECIMAL(18,3);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE requisition_items
      DROP COLUMN IF EXISTS actual_closing;
    `)
  }
}
