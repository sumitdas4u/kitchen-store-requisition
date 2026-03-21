import { MigrationInterface, QueryRunner } from 'typeorm'

export class RequisitionErpSyncFields20260320160000 implements MigrationInterface {
  name = 'RequisitionErpSyncFields20260320160000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE requisitions
        ADD COLUMN IF NOT EXISTS erp_synced BOOLEAN NOT NULL DEFAULT false;
    `)

    await queryRunner.query(`
      ALTER TABLE requisitions
        ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;
    `)

    await queryRunner.query(`
      ALTER TABLE requisition_items
        ADD COLUMN IF NOT EXISTS erp_mr_item_name VARCHAR(200);
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_requisitions_erp_name
        ON requisitions(erp_name);
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_requisitions_erp_synced
        ON requisitions(erp_synced) WHERE erp_synced = false;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_requisitions_erp_synced`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_requisitions_erp_name`)
    await queryRunner.query(`ALTER TABLE requisition_items DROP COLUMN IF EXISTS erp_mr_item_name`)
    await queryRunner.query(`ALTER TABLE requisitions DROP COLUMN IF EXISTS last_synced_at`)
    await queryRunner.query(`ALTER TABLE requisitions DROP COLUMN IF EXISTS erp_synced`)
  }
}
