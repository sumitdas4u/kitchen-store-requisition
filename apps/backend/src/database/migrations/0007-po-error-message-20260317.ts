import { MigrationInterface, QueryRunner } from 'typeorm'

export class PoErrorMessage20260317180000 implements MigrationInterface {
  name = 'PoErrorMessage20260317180000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendor_order_pos
        ADD COLUMN IF NOT EXISTS error_message TEXT;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vendor_order_pos DROP COLUMN IF EXISTS error_message;
    `)
  }
}
