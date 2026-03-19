import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddStoreNote2026031514301690 implements MigrationInterface {
  name = 'AddStoreNote2026031514301690'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE requisitions
      ADD COLUMN IF NOT EXISTS store_note TEXT;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE requisitions
      DROP COLUMN IF EXISTS store_note;
    `)
  }
}
