import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddStoreNote20260315143000 implements MigrationInterface {
  name = 'AddStoreNote20260315143000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS requisitions
      ADD COLUMN IF NOT EXISTS store_note TEXT;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS requisitions
      DROP COLUMN IF EXISTS store_note;
    `)
  }
}
